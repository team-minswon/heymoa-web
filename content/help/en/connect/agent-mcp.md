---
title: Connect AI apps (MCP)
description: Let AI apps like Claude and ChatGPT read the meetings and projects in your workspace. This page also covers how to disconnect them.
group: connect
slug: agent-mcp
order: 2
---

## Connect an AI app {#connect}

With MCP (a standard way for AI apps to read data from other services), AI apps like Claude and ChatGPT can read the meetings and projects in a workspace you grant them. ==They can only read, and never change anything.==

1. **Click [New connection]**
   It's in **[Settings]** → **[Account]** → **[My MCP connections]**.
2. **Choose the app you use**
   Pick **[Claude app]**, **[Claude Code]**, **[Codex]**, or **[ChatGPT]**.
3. **Add the address shown to your app**
   The steps appear on screen.
4. **Choose a workspace**
   An OAuth (a way to give an app access through the account you're signed in with) permission page opens in your browser.
5. **Click [Allow]**
   The app can now read the workspace.

![The My MCP connections screen with an app picker card, four apps, and connection steps](img:agent-mcp/new-connection.webp "Choose an app in [New connection] to see the steps.")

A connection expires on its own if it isn't used for 90 days. Click **[Revoke]** to disconnect at any time. **[Usage history]** shows when the app used which tool. The text of questions and answers isn't recorded.

For how to use it from an outside AI app, see [I want to use HeyMoa from an AI app (MCP)](help:use-mcp). For what data is processed, see the [Privacy Policy](/privacy).

## What apps can read {#reads}

In the connected workspace, an app can read:

- Lists of projects and meetings
- Meeting transcripts, with speakers and timestamps
- Decisions, tasks, and questions confirmed in projects, along with the remarks behind them and how they relate
- Tasks that aren't finished yet

If an app asks for a HeyMoa page address, it only gets addresses for a new meeting, a meeting page, a source remark, or a review page. Apps can't start meetings or change items.

An app reads only within the permissions of the user who connected it. If that user leaves the workspace, the connection is revoked automatically.

## Create a personal token when there's no browser {#token}

Where there's no browser, use a personal token (an access password you give to the app). Any workspace member can create one.

1. **Click [Create personal token]**
   It's on the **[My MCP connections]** screen.
2. **Choose the workspace and a connection name**
   **[Connection name]** can be up to 50 characters.
3. **Copy the token**
   ==The token is shown only once, right after you create it.==

## Manage MCP connections as an admin {#admin}

Admins turn **[Allow MCP connection]** on or off in **[Settings]** → **[Workspace]** → **[Manage MCP]**. While it's off, no one can create new connections.

> [!Can't be undone]
> Turning off **[Allow MCP connection]** revokes every existing connection to this workspace. Turning it back on doesn't restore them.

**[Open connections]** shows each connected app's name, type, who granted access, and when it was last used. Click **[Disconnect]** to end a connection. You can't see other people's usage history.

## Frequently asked questions {#faq}

### Can a connected app edit or delete meetings?
No. It can only read. It can't start meetings or change items.

### Can a connection end on its own?
Yes. It expires after 90 days without use. It's also revoked automatically if the user who connected it leaves the workspace.

### Can I create a personal token if I'm not an admin?
Yes. Any workspace member can create one. But if an admin turns off **[Allow MCP connection]**, no one can create new connections.

## Related pages {#related}

- [I want to use HeyMoa from an AI app (MCP)](help:use-mcp) — Connection steps for each app
- [Integrations](help:integrations) — Connect issue trackers
