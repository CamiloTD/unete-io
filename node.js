const UneteIOClient = require('./socket');

async function Server (url, api) {
    var host, name;
    
    host = url.substring(0, url.lastIndexOf('/'));
    name = url.substring(url.lastIndexOf('/') + 1);

    const proxy = UneteIOClient(host, api);
    
    return await proxy.register(name);
}

function Client (url) {
    var [ host, addr ] = url.split('@');
    
    const proxy = UneteIOClient(host);
    var client;
    
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

                pointer[value[value.length - 1]];
            }
        });
    
        return proxy;
    }

    return Handler(async function (base_route, ...args) {
        if(!client) client = await proxy.connect(addr);

        return await proxy.call_method(addr, base_route, ...args);
    });
}

exports.Server = Server;
exports.Client = Client;