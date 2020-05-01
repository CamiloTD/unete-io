#!/usr/bin/env node
const cli = require('commander');
const path = require('path');
const Server = require('./server');
const Sock = require('./socket');
const repl = require('repl');
const { encrypt, decrypt } =  require('./aes');
const net = require('net');
const readline = require('readline-sync');

require('colors');

cli.version('1.0.0')
   .option('-c, --connect <url>', 'Connect to unete service')
   .option('-d, --debug', 'Starts a Debugger CLI')
   .option('-p, --port <port>', 'Set port')
   .option('-m, --module <filename>', 'Set module to export')
   .option('-l, --log <port>', 'Opens a tcp log server.')
   .option('-a, --attach <url>', 'Connects to an log unete-io service')
   .parse(process.argv);

function connectToCli (connect) {
    console.log(`Connecting to ${connect}...`);

    (async () => {
        let client = Sock(connect);

        const r = repl.start({
            prompt: 'unete> ',
            eval: async (cmd, ctx, filename, cb) => {
                if(cmd.trim() === "exit") process.exit(0);

                try {
                    let rs = await eval('client.' + cmd);

                    cb(null, rs);
                } catch (exc) {
                    cb(exc);
                }
            }
        });
    })();
}

let { port, connect, debug, log, attach }  = cli;

if(connect) return connectToCli(connect);

if(log) {
    const { LOG_PASS } = process.env;
    log = +log;

    if(isNaN(log))  {
        console.log('Invalid log port'.red.bold);
        console.log("Quitting...");
        process.exit();
    }
    
    if(!LOG_PASS) {
        console.log('Please define '.red.bold + 'LOG_PASS'.cyan.bold + ' as environment variable.'.red.bold);
        console.log("Quitting...");
        process.exit();
    }

    net.createServer((sock) => {
        sock.once('data', (chunk) => {
            try {
                let data = decrypt(chunk, LOG_PASS).toString().trim();
                if(data !== LOG_PASS) return sock.end();
                
                on_stdout((data) => {
                    
                    try {
                        sock.write(encrypt(data, LOG_PASS));
                    } catch (exc) {
                        sock.end();
                    }
                });
            } catch (exc) {
                sock.end();
            }
        });
    }).listen(log);
}

if(attach) {
    const socket = new net.Socket();
    const [host, port, pass] = attach.split(':');
    const password = pass || readline.question('Pleas enter the log security password:', { hideEchoBack: true });
    
    socket.connect(port, host, () => {
        socket.on('data', (chunk) => {
            const data = decrypt(chunk, password);

            process.stdout.write(data);
        })

        socket.write(encrypt(password, password));
    });
}

if(cli.module) {
    if(!port) throw "PORT_EXPECTED";

    let _module = require(path.join(process.cwd(), cli.module || 'index.js'));

    let server = new Server(_module);

    (async () => {
        await server.listen(port);
        console.log("Microservice running at port :" + port);
        if(debug) return connectToCli(`http://127.0.0.1:${port}`);
    })();
}

function on_stdout (cb) {
    const old_write = process.stdout.write;

    process.stdout.write = (data) => {
        old_write.call(process.stdout, data);
        cb(data);
    }
}