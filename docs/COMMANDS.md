# Commands and configuration

## Commands

| Command | What it does |
|---|---|
| `kaya` | Chat in the terminal |
| `kaya pair [name]` | Show a QR to connect the app |
| `kaya tasks` | Routines: list, pause, resume, cancel |
| `kaya ideas` | Suggestions with the evidence behind them |
| `kaya model [list\|use provider:model]` | See or change the model |
| `kaya mcp list\|add\|edit\|remove\|test` | Tool servers |
| `kaya connector ...` | Portable connectors (validate, install, sign) |
| `kaya skills ...` | List, add, remove, enable, disable skills |
| `kaya state backup\|export\|import\|inspect\|prune` | Snapshots and portable state |
| `kaya update` | Update Kaya |
| `kaya auth reset-password` | Reset the console password |
| `kaya status`, `kaya verify` | Health and the real product checks |
| `kaya reset` | Factory reset (with exclusions) |
| `kaya relay link\|status\|unlink\|pair` | Kaya Connect: link this Pod, check it, forget it, connect a phone by QR |
| `kaya relay setup\|run\|clients\|revoke` | Your own relay |

## Inside a chat

`/memory`, `/activity`, `/devices`, `/files`, `/attach <path>`, `/model`,
`/context`, `/routines`, `/tasks`, `/ideas`, `/thread`, `/main`, `/rewind`,
`/details`, `/clear`, `/help`.

## Configuration

Precedence, highest first: environment variables, then `.secrets.json` (sealed;
API keys and tokens), then `config.json` (model, providers, channels), then
defaults. Secrets are set from the console or app, never by editing files. `.env`
holds only system settings (`KAYA_API_PORT`, `TZ`).

| Where | What |
|---|---|
| `/var/kaya/config/` | `config.json`, sealed secrets, the master key. Mode `0700`. |
| `/var/lib/kaya/workspace/` | Identity, memory, skills, sessions, files. Owned by whoever installed Kaya. |
| `/var/lib/kaya/backups/` | Recovery snapshots. |

The services run as root; every file they create in your workspace and config is
handed back to the account that installed Kaya, so your own terminal can always
read them.
