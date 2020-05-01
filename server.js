let socket_io = require('socket.io');
let Socket = require('./socket');

class Server extends socket_io {
    
    constructor (functions = {}, server) {
        super(server), {
            pingTimeout: 30000,
            pingInterval: 60000
        };
        const private_functions = {};
        
        set('$before_call');
        set('$after_call');
        set('$after_error');

        function set (k) {
            if(!functions[k]) return;

            private_functions[k] = functions[k];
            delete functions[k];
        }

        this.on('connection', (sock) => Socket(sock, functions, { with_observables: true, private_functions }));
    }
    
}

module.exports = Server;