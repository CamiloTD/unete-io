import socket_io from "socket.io";

declare const Socket: (
    sock: SocketIOClient.Socket | string | Promise<any>,
    functions?: any,
    options?:{
        with_observables?: boolean;
        with_proxies?: boolean;
    }
) => any;

declare class Server extends (SocketIO as any) {
    constructor (functions: any, server?: any);
}