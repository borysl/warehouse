# KBGate repository

Every page, issue or message KBGate mirrors is a folder with a `readme.md`.
A `<client>.remote.yml` says which system a client mirrors.

- `pull <client> [target]` brings the server copy in.
- `push <client> [target]` sends the local changes; `push -t` shows them first.
- Do not edit the `.<client>/` folders: KBGate keeps its own state there.
- Every time KBGate writes is in UTC.
