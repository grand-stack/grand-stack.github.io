---
title: "Quickstart"
description: "Clone the repos, start the stack, query the API, connect an agent."
url: "/quickstart/"
---

This page takes you from nothing to a running graph API, then adds the optional layers. Everything runs on your machine in containers. Each command below is the one the repositories' own READMEs document and test.

You need Docker or Podman with compose, and Node 22 or later if you want to run the examples or tests. On macOS with Podman, `docker` may be an alias: run `podman machine start` first.

## 1. Clone the repositories side by side

The compose files live in the `grandstack` repository and build the others from their sibling folders, so they must sit next to each other in one folder.

```sh
mkdir grand-stack && cd grand-stack          # any folder name; the repositories go inside it
git clone https://github.com/grand-stack/grandstack
git clone https://github.com/grand-stack/grandstack-server
git clone https://github.com/grand-stack/grandstack-web
```

The optional layers each need their own repository beside these. Clone them when you reach the step that uses them:

```sh
git clone https://github.com/grand-stack/grandstack-agents       # step 4
git clone https://github.com/grand-stack/grandstack-auth         # step 5, login
git clone https://github.com/grand-stack/grandstack-federation   # step 5, federation
```

## 2. Start the default stack

```sh
cd grandstack
cp .env.example .env      # once
docker compose up --build
```

Wait for the server log line `GraphQL ready at http://localhost:4000/graphql`. You now have:

| Open | What |
| --- | --- |
| http://localhost:3000 | The web app: search, filter, compare, graph views, people, create, edit and delete |
| http://localhost:4000/graphql | The GraphQL API and GraphiQL |
| http://localhost:7474 | Neo4j Browser (user `neo4j`, password `grandstack-dev` unless you changed `NEO4J_PASSWORD` in `.env`) |

The default stack has **no authentication**. Run it locally and do not expose it. Reset the data any time with `docker compose down -v`.

## 3. Query the API

```sh
curl -s localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ people(sort: [{ directedCount: DESC }], limit: 3) { name directedCount } }"}'
```

returns the three people who directed the most films in the sample data: Christopher Nolan 8, Steven Spielberg 7, Quentin Tarantino 6. More queries are on the [examples](/examples/) page, and every type and field is described in the [schema reference](/docs/grandstack-server/schema-reference/).

## 4. Connect an agent

An MCP server that runs GraphQL statements is one more compose file. It is read-only by default.

```sh
docker compose down
docker compose -f compose.yaml -f compose.agents.yaml up --build
claude mcp add --transport http grandstack http://localhost:4100/mcp
```

The endpoint has no auth of its own, so keep it on your machine. To turn writes on, start compose with `AGENTS_ALLOW_MUTATIONS=true` (compose passes it to the server as `ALLOW_MUTATIONS=true`, the name the MCP docs use). See the [MCP server guide](/docs/grandstack-agents/mcp-server/) for Claude Desktop and your own apps, and [schema design for agents](/docs/grandstack-agents/schema-design-for-agents/) for why your type definitions matter.

## 5. Add login, or federation

Each is an opt-in override of the same compose file, and each replaces the others on port 4000, so stop the running setup first (`docker compose down`, with the same `-f` files you started it with) before starting another.

```sh
# login with Keycloak and a gateway (development only); needs the grandstack-auth repo
docker compose -f compose.yaml -f compose.auth.yaml up --build

# Wikipedia summaries on films and people through a gateway (needs internet); needs grandstack-federation
docker compose -f compose.yaml -f compose.federation.yaml up --build
```

Read [the auth docs](/docs/grandstack-auth/) and [the federation docs](/docs/grandstack-federation/) before relying on either.

## What next

- Build your own app on your own data: [the tutorial](/docs/grandstack/build-your-own-app/).
- Change the schema, seed data or UI: the recipes in each repo's docs.
- Working with a coding agent? Point it at [the agent guide](/docs/grandstack/agents/) and `AGENTS.md` in each repo, or at [llms.txt](/llms.txt).
