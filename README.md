# Unete-IO

JS Minimalist, Flexible & Powerful microservices & api library

🚨 **ALERT:** Unete-IO is the socket.io library of the **Unete** ecosystem, if you want to mount a server, please go to **unete-serve**. 🚨

## What's Unete-IO?

![https://i.ibb.co/zSh4bQZ/UneteIO.png](https://i.ibb.co/zSh4bQZ/UneteIO.png)


Unete-IO is an RPC library that takes any vanilla Javascript (or Typescript) module and exports it to the web as a realtime API.

## Installation
UneteIO is a regular JS module, install it by using:

```bash
$ npm i @unete/io
```

## Client
### Connect to a Unete-IO Server
```ts
import { Socket } from "unete-io";

// Create Connection & Initialize API
const Service = Socket("http://localhost");

async function main () {
	// Call methods as vanilla js objects
	const result = await Service.sum(1,2,3);	

	console.log(result);
}

main();
```

## Server

### Create a Unete-IO Server

```ts
import { Server } from "unete-io";

const server = new Server({
	
	sum (...nums: number[])  {
		let sum = 0;
		
		for(const num of nums) sum += num;

		return sum;
	},
	
	// Following methods are optional, only use them if you really need to hook internal operations
	
	$before_call({ path, iid, args }){}, // Before Method Execution
	$after_call({ path, iid, args, timestamp, res }){}, // Before Method Execution
	$after_error({ path, iid, error }){},
	
	$error(error: any){}, // Transform errors before being sent to the client, if you only want to hook the exceptions, use $after_error
	
})

server.listen(8080, () => console.log("Server up and running!"));
```


## Features

- [x] **Client Side**
	- [x] Access backend methods as regular functions using Javascript reflection
- [ ] **Data Transmission**
	- [x]  Primitive & JSON Objects
	- [x]  ~~Support for remote Callbacks~~ *(Use Observables when possible)*
	- [x] Support for remote observables *(No HTTP)*
