# Cero to Production — API

Cero to Production is a project where we are building a productivity management application called "RETO" in this series of live coding sessions. The idea behind this sessions is to show all the complications and real thinking and decision making that common programmer do in daily basis with JavaScript.

The project is live streaming in [Twitch](https://glrz.me/stream) in Spanish, every Tuesdays and Thursdays.

## Development environment

Feel free to use a local Mongo database or use the [docker-compose](https://docs.docker.com/compose)

On the root of the project run the following command

```bash
cat .env.example > .env
```

Fill all the environment variables on the `.env` file

```bash
yarn install
```

Run the API

```bash
yarn dev
```
