# Peer to Peer auction challenge by jose

Hello dear team!

I got to complete all the required features with some caveats:

- The logs deffer a lot, sorry I ran out of time
- I couldn't figure out the correct way to discover all the `peers` only by using `@hyperswarm/rpc` so I used a normal `hyperswarm` with a harcoded `topic`. **SORRY**
- Some times, some peers don't connect to the `swarm` I still have to debug.
- Some times when you `ctr + c` any `peer`, the other `peers` get a disconnection error that I still have to debug.
- The `sell_orders` database is currently initialized by `server.mjs`. IMO there should be a configuration step before starting `server.mjs` and `client.mjs` that takes care of initializing the requried databases.
- I wouldd also loved to have time to refactor the code so that the access to the database is easier for follow, right now to make it easier to read I left everything in `server.mjs` there is no `db` access in `client.mjs`
- **NOTE:** I would love to know the best way to share the `swarm topic` with all the `peers`, right now I have hardcoded it.

## In this document

- [How to run it](#how-to-run-it)
- [Part of the challenge TODOs](#part-of-the-challenge-todos)
  - [Good To Have TODOs](#good-to-have-todos)
- [Demo](#demo)




## How to run it
```bash
# in the root of the project run
npm install
```
```bash
# create the bootstrap node with:
hyperdht --bootstrap --host 127.0.0.1 --port 30001
```

```bash
# start one peer per terminal session, MAKE SURE TO PASS THE NAME: it is important because that is how I create a db folder for each peer
# npm start <peer-name>
npm start alice
```

```bash
# the app will capture the stdin and interpret commands everytime you hit enter
## Available commands
# A health check for the own server
ping

# A sell product command
sell:<prod>:<initial-price>

# A bid command
# <peer-pub-key> is logged after running 
# > npm start alice
bid:<prod>:<bid-price>:<peer-pub-key>

# A terminate sell command
terminate:<prod>
```
## Part of the challenge TODOs

- [x] Peer Client: create `sell` command
- [x] Peer Client/Server: notify other parties about the new auction
- [x] Peer Server: create `bid` command
- [x] Peer Server: propagate/notify other parties about the new bid
- [x] Peer Client: create `terminate` sell command
- [x] Peer Client: propagate/notify other parties about the termination of the `sell_order`
- [x] Peer Server: propagate auction status

### Good To Have TODOs

- [x] Get client example running
- [x] Get server example running
- [x] Modify server and client to accept `peerName`
- [x] Modify Server and Client to destroy `rpc` and `dht` when process finishes
- [x] Use peer public key to make RPC calls
- [ ] **OPTIONAL** rpc call to get peer prefered name (`peer-name`) to improve `UX`
- [ ] Show a prompt when peer disconets
- [ ] Peer Server: fail `bid` if `sell_order` is `terminated`
- [ ] Peer Server: fail `bid` if the price is not bigger than current

## Demo

<video width="320" height="240" controls>
  <source src="./demo.mp4" type="video/mp4">
Your browser does not support the video tag.
</video>
