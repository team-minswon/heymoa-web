---
title: Integrations
description: When an admin connects tools like Linear and GitHub to the workspace, My agent can find and create issues there. Here's how to connect them.
group: connect
slug: integrations
order: 1
modified: 2026-10-23
---

## Connect a tool {#connect}

Integrations connect HeyMoa to the tools your team already uses. Right now you can connect Linear (issue tracking) and GitHub (code hosting). Integrations belong to a workspace (the space your team shares), and you can have one per tool.

Only admins can connect and disconnect integrations. If you're not an admin, the buttons are hidden and a message says only admins can do this. If you need a new integration, ask an admin.

1. **Open the integration card**
   Go to **[Settings]** → **[Workspace]** → **[Integrations]** and find the card for the tool (currently **Linear** and **GitHub**).
2. **Click [Connect]**
   You're taken to the tool's sign-in page. Sign in and allow access, and you'll come back.
3. **Check the result**
   Once connected, you'll see **[Connected]** with who connected it and when. If it fails, you'll see “The integration couldn't be connected. Please try again later.”

![The Integrations tab in Settings, with Linear connected and GitHub not connected](img:integrations/settings.webp "Integration settings. Only admins can connect and disconnect.")

If another admin reconnects a tool, they become the person listed as having connected it. To disconnect, click **[Disconnect]**.

## What integrations let you do {#use}

[My agent](help:agent) uses integrations to find and create issues.

- Linear: Look up teams and issues, and create and edit issues.
- GitHub: Search repositories and issues, and create issues.

==Creating and editing only happen after you click **[Approve]** on the approval card.== HeyMoa doesn't pull data from connected services on a schedule.

> [!Caution]
> If the admin who connected a tool leaves the workspace or is removed, the integrations they set up are disconnected automatically. An admin then needs to connect them again.

## When an integration stops working {#reauth}

:::problem
**Symptom:** “The integration needs to be reauthorized.” appears
**Cause:** The integration has to be authorized again before you can use it.
**Fix:** An admin should connect that service again. The steps are the same as in Connect a tool above.
:::

## Frequently asked questions {#faq}

### Can I set up an integration if I'm not an admin?
No. Only admins can connect and disconnect integrations. Ask an admin.

### Will issues be created without approval once a tool is connected?
No. Creating and editing only happen after you click **[Approve]** on the approval card.

### Can I have more than one integration per service?
No. A workspace can have one integration per service.

## Related pages {#related}

- [My agent](help:agent) — Find and create issues in connected services
- [Connect AI apps (MCP)](help:agent-mcp) — Let outside AI apps read your meetings and projects
