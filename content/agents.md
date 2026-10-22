---
title: "For agents"
description: "How coding agents and agentic apps should use GRANDstack: what to read, how to connect, and what to be careful about."
url: "/agents/"
---

The **A** in GRANDstack stands for **Agent**: the GraphQL API that serves the web app is meant to serve coding agents and agentic apps too. This page is the short version for an agent, or for a person directing one.

## What to read

| Fetch | For |
| --- | --- |
| [/llms.txt](/llms.txt) | An index of the docs, with one-line descriptions and absolute links |
| [/llms-full.txt](/llms-full.txt) | All the documentation in one text file |
| [Agent guide](/docs/grandstack/agents/) | The mental model, where to change what, a verification checklist, gotchas |
| `AGENTS.md` in each repository | How to run, test and change that repository ([grandstack](/docs/grandstack/agents-md/), [server](/docs/grandstack-server/agents-md/), [web](/docs/grandstack-web/agents-md/), [auth](/docs/grandstack-auth/agents-md/), [agents](/docs/grandstack-agents/agents-md/), [federation](/docs/grandstack-federation/agents-md/)) |
| [Schema reference](/docs/grandstack-server/schema-reference/) | Every type and field with its description |

## Using the API

Two ways, both documented and tested in [grandstack-agents](/docs/grandstack-agents/):

1. **Directly.** Send GraphQL to `http://localhost:4000/graphql`. [Direct GraphQL](/docs/grandstack-agents/direct-graphql/) shows the loop an agent follows: introspect, build a query, read the error, correct it. [The agent loop](/docs/grandstack-agents/agent-loop/) is a runnable example behind a small model adapter.
2. **Through MCP.** A small server with four generic tools (`get_schema`, `describe_type`, `run_query`, `run_mutation`) over stdio or HTTP. It reads the schema by introspection, so it works with other GraphQL servers too.

```sh
claude mcp add --transport http grandstack http://localhost:4100/mcp
```

## Be careful with writes

- **MCP is read-only by default.** `run_mutation` does nothing until the server starts with `ALLOW_MUTATIONS=true`. That flag guards the MCP path only; the server behind it is open. See [guardrails](/docs/grandstack-agents/guardrails/).
- **Real control is auth.** [Adding auth](/docs/grandstack-agents/adding-auth/) shows the same tools using a token against the `grandstack-auth` gateway, so an agent gets exactly the permissions of its role.

## Design the schema for the agent

Type definitions straight from introspection work, but a schema tailored to the questions you want answered works better: descriptions, stored answers to common questions, names for the task, and `@cypher` where the generated Cypher is slow or does not fit. Newer models do better too, and the schema is the part you control. See [designing the type definitions for agents](/docs/grandstack-agents/schema-design-for-agents/).

## Federation

With the federation setup, the agent sees one combined API; describe cross-source fields well. [How federation works](/docs/grandstack-federation/how-it-works/#auth-and-agents).
