const { Observable, Subject, from, interval } = require('rxjs');
const UneteIO = require('..');

//* --------------------- BackEnd  ---------------------
new UneteIO.Server({

    timer () { return interval(1000); }

}).listen(7000);

//* ---------------------- FrontEnd ---------------------

const Client = UneteIO.Socket('http://localhost:7000');

(async () => {
    const timer = await Client.timer();

    timer.subscribe(t => console.log("Remote Timer:", t));
})();