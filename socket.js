const serializeError = require('serialize-error');
const io = require('socket.io-client');
const { Observable, ReplaySubject, isObservable } = require('rxjs');
const { from } = require('rxjs/operators');

const OBSERVABLE = 1;

function Socket (sock, functions = {}, { with_proxy=true, with_observables = true, private_functions } = {}) {

    {//? @note (Main) Init
        {//? @note (Init) Initialize exported methods
            functions = functions || {};
            if(functions instanceof Promise) {
                functions.then((x) => {
                    calls = functions = x;

                    x.$public = () => destructureMap(functions);
                });
                
                functions = {};
            }

            functions.$public = () => destructureMap(functions);
        }

        {//? @note (Init) Connect & Initialize Handler Proxy
            var Handler; initializeHandler();
            sock = typeof sock === "string"? io.connect(sock) : sock;
    
            if(sock instanceof Promise) {
                sock.then((url) => {
                    sock = io.connect(url);
                    initializeSocket();
                });
            } else initializeSocket();
        }

        {//? @note (Init) Define status vars
            var calls = functions;
            var handlers = {
                success: {},
                failure: {}
            };

            var _iid = 0;

            var connection_id = Math.floor(Date.now() * Math.random());
            var id = () => `${connection_id}-${++_iid}`;

            var handler = Handler(call);
            var observables = {};
            var my_observables = new Set()
        }
    }

    {//? @note (Main) Handle Observables Events
        if(with_observables) {
            sock.on('obs', function ({ iid, data }) {
                if(!observables[iid]) observables[iid] = new ReplaySubject();

                observables[iid].next(data);
            });

            sock.on('obs-complete', function ({ iid, data }) {
                if(!observables[iid]) observables[iid] = new ReplaySubject();

                observables[iid].complete();
            });

            sock.on('obs-error', function ({ iid, exc }) {
                if(!observables[iid]) observables[iid] = new ReplaySubject();

                observables[iid].error(exc);
            });
        }
    }

    {//? @note (Main) Define Functions
        {//? @note (Functions) Promise Handlers
            function removeHandlers (iid) {
                delete handlers.success[iid];
                delete handlers.failure[iid];
            }

            function setSuccessHandler (iid, fn) {
                handlers.success[iid] = fn;
            }

            function setFailureHandler (iid, fn) {
                handlers.failure[iid] = fn;
            }

            function addToHandler (obj, base=handler, route=[]) {
                for(let i in obj) {
                    if(typeof obj[i] === "object" && !Array.isArray(obj[i]) && !Array.isArray(obj[i].arguments)) {
                        if(!base[i]) base[i] = {};

                        addToHandler(obj[i], base[i], [...route, i]);
                    } else {
                        base[i] = (...args) => call([...route, i], ...args);
                    }
                }
            }
        }

        {//? @note (Functions) Utility
            function getFunction (path) {
                let pointer = calls;
                for(let i=0, l=path.length;i<l;i++) pointer = pointer[path[i]];
                
                return pointer;
            }

            function destructureMap (obj, path=[]) {
                const base = {};

                for(let i in obj) {
                    let x = obj[i];
                    
                    if(typeof x === "object" && !Array.isArray(x)) base[i] = destructureMap(x, [...path, i]);
                    else base[i] = {
                        arguments: getParamNames(x)
                    }
                }

                return base;
            }
        }

        {//? @note (Functions) Main
            function initializeSocket () {
                //* Server side, onCallReceived
                sock.on('call', async ({ path, iid, args, cb }) => {
                    try {
                        const starting_time = Date.now();
                        await Connect();
                        
                        let fn = getFunction(path);
                        
                        for(let i in cb) args[i] = (..._args) => call([cb[i]], ..._args);
                        if(typeof fn !== "function") throw 'UNKOWN_METHOD';
                        
                        private_functions && private_functions.$before_call && private_functions.$before_call({ path, iid, args, src: {
                            host: sock.request.connection.remoteAddress,
                            port: sock.request.connection.remotePort
                        }});
        
                        let result = await fn.apply(handler, args);
        
                        //* Results
                        if(isObservable(result)) {
        
                            const subscription = result.subscribe({
                                next: (data) => sock.emit(`obs`, { iid, data }),
                                complete: () => {
                                    sock.emit(`obs-complete`, { iid });
                                    my_observables.delete(subscription);
                                    subscription.unsubscribe()
                                },
                                error: (exc) => {
                                    if(exc instanceof Error) exc = serializeError(exc);
                                    if(functions.$error) exc = functions.$error(exc);
                                    
                                    sock.emit(`obs-error`, { iid, exc });
        
                                    my_observables.delete(subscription);
                                    subscription.unsubscribe()
                                }
                            });
                            my_observables.add(subscription);
                            
                            sock.emit('res', { iid, res: iid, flags: OBSERVABLE });                        
                        } else sock.emit('res', { iid, res: result, flags: 0 });
                        
                        private_functions && private_functions.$after_call && private_functions.$after_call({ path, args, iid, timestamp: Date.now(), res: result });
                    } catch (exc) {
                        if(exc instanceof Error) exc = serializeError(exc);
                        if(functions.$error) exc = functions.$error(exc);
                        
                        sock.emit('exc', { iid, exc });
        
                        private_functions && private_functions.$after_error && private_functions.$after_error({ path, args, iid, timestamp: Date.now(), error: exc });
                    }
                });
        
                sock.on('res', ({ iid, res, flags }) => {
                    if(flags & OBSERVABLE)
                        res = observables[iid] = observables[iid] || new ReplaySubject();
                    
                    handlers.success[iid] && handlers.success[iid](res);
                    removeHandlers(iid);
                });
                
                sock.on('exc', ({ iid, exc }) => {
                    handlers.failure[iid] && handlers.failure[iid](exc);
            
                    removeHandlers(iid);
                });
                
                sock.on('disconnect', () => {
                    for(let i in handlers.failure)
                        handlers.failure[i]('DISCONNECTED');
                    
                    for(let obs of my_observables)
                        obs.unsubscribe()
                });
            }
        
            function initializeHandler () {
                if(with_proxy) {
                    Handler = function Handler (cb, base_route = []) {
                        let proxy = new Proxy(function () {}, {
                            get (target, route, receiver) {
                                if(route === '$sock') return sock;
                                return Handler(cb, [...base_route, route]);
                            },
                    
                            apply (target, thisArg, args) {
                                return cb && cb(base_route, ...args);
                            },
        
                            set (target, prop, value) {
                                let pointer = functions;
                                
                                for(let i=0, l=value.length - 1;i<l;i++)
                                    pointer = pointer[prop];
        
                                pointer[value[value.length - 1]] = value;
                            }
                        });
                    
                        return proxy;
                    }
                } else {
                    Handler = function Handler ($call) {
                        return {
                            async $connect () {
                                let routes = await $call(['$public']);
                                
                                addToHandler(routes);
                            }
                        };
                    }
                }
            }

            async function call (routes, ...args) {
                if(sock instanceof Promise) await sock;
        
                await Connect();
                
                let iid = id();
                let callbacks = {};
        
                for(let i=0, l=args.length;i<l;i++) {
                    let arg = args[i];
        
                    if(typeof arg === "function") {
                        let cb_id = id();
        
                        callbacks[i] = cb_id;
                        calls[cb_id]= arg;
                    }
                }
        
                sock.emit('call', {
                    path: routes,
                    iid: iid,
                    args: args,
                    cb: callbacks
                });
                
                return await new Promise((success, failure) => {
                    setSuccessHandler(iid, success);
                    setFailureHandler(iid, failure);
                });
            }
        }

        {//? @note (Functions) Connect
            var Connect = () => new Promise((success, failure) => {
                if(sock.id) return success();
        
                sock.once('connect', success);
                sock.once('connect_error', (err) => {
                    if(err === "timeout") Connect(success, failure);
                    else failure(err);
                });
                sock.once('error', (err) => {
                    failure(err);
                });
            });
        }
    }

    return handler;
}
{//? @note Exports
    module.exports = Socket;
    module.exports.NoProxy = (sock, fn) => Socket(sock, fn, { with_proxy: false, observables: true });
}

{//? @note Utility Functions
    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var ARGUMENT_NAMES = /([^\s,]+)/g;

    function getParamNames(func) {
        var fnStr = func.toString().replace(STRIP_COMMENTS, '');
        var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        if(result === null)
            result = [];
        return result;
    }
}