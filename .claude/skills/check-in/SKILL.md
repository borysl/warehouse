---
name: check-in
description: Record items at the UDS storage during an inventory visit. Use when the user is at the storage, photographing and dictating items to check in (returning an In Hands item, or registering a new one), and the result must be written into the kbgate mirror files so it can be pushed to the Google Sheet later.
---

# Check-in at the storage

The user is physically at the storage, taking photos and dictating. Talk to them in Ukrainian, keep answers short (one item at a time, they are standing with a phone). Everything written to files is in English.

Paths (Windows, always PowerShell or the Read/Write/Edit tools):

- Records: `C:\Users\BorysLebeda\inventory\UDS_Files\Inventory\UDS_Storage\Inventory\<Id>\readme.md`
- Photos: `C:\Users\BorysLebeda\inventory\UDS_Files\Inventory\Inventory_Photos\`
- Staging for new rows: `C:\Users\BorysLebeda\inventory\UDS_Files\Inventory\New_items.tsv`

## Hard rules

- Never touch `.gtable\`, `.inbox\` or any dotted folder. They are kbgate state.
- Never run `pull` or `push`. Tell the user the commands at the end.
- Never overwrite `## Log`. Append a new line.
- Never invent an Id outside the scheme below. Show the Id to the user and wait for confirmation before writing.
- Do not rename existing Ids or folders.

## Id scheme

The first digit is the category. Next Id = highest existing numeric folder in the group + 1. Recompute it from the folder list every time (several items may be added in one visit).

| Group | Category | Rule |
|---|---|---|
| 10-19 | Furniture, shelves, floor (19 = floor) | two-digit, take a free number |
| 2xx | Goods / AuctionItem | max in 200-299 + 1 |
| 3xx | Banquet (items and their containers) | max in 300-399 + 1 |
| 4xx | Rally + Events | 400 and up |
| 5xx | Marketing + PrintedMaterial | 500 and up |
| 6xx | Military + Medical | 600 and up |
| 7xx | Office | 700 and up |
| 8xx | Container of any category except Banquet | max in 800-899 + 1 |
| 9xx | Uncategorized | 900 and up |

`Type: Container` with `Category: Banquet` goes to 3xx. `Type: Container` with any other category goes to 8xx. Zero is never a first digit. Ids 323 (empty placeholder) and the `row_*` folders are not touched.

## Record format

`readme.md` of a record, in this exact shape (empty properties are omitted, `Quantity` is quoted):

```
---
type: Set
status: At Storage
_webLink: https://docs.google.com/spreadsheets/d/1yqVU0OF08OIdoaYxdiZUla0pWb0JwOpzzZuvpip_pVI/edit#gid=1889369453
Name: Karaoke Speaker
Category: Rally
Quantity: '1'
Holder: Aurora
Container: 16A
Main_Location: Seattle
Photo: 148_Karaoke_Speaker.jpg
Last update: 11/7/2026
Damages: ...
Owner: UDS
Donated by: ...
Registered: 11/7/2026 0:00:00
---

# Karaoke Speaker

## StorageGuidelines: Where we can find it?

<one plain sentence>

## Log

<one line per event>

## Description

<text>
```

- Property order: `type`, `status`, `_webLink`, `Name`, `Category`, `Quantity`, `Holder`, `Container`, `Main_Location`, `Photo`, `Last update`, `Damages`, `Owner`, `Checklist`, `Donated by`, `Registered`.
- Dates are `M/D/YYYY`; `Registered` is `M/D/YYYY 0:00:00`. Use today's date.
- `type` values: Asset, AuctionItem, Container, Expendables, PrintedMaterial, Set, Unknown. `status` values: `For review`, `At Storage`, `In Hands`.
- `Category` values: Banquet, Events, Furniture, Goods, Marketing, Medical, Military, Office, PrintedMaterial, Rally, Suitcases, Uncategorized.
- `Main_Location`: Seattle, Tacoma, EastSide or Other. `Owner`: `UDS` or a person.
- Write UTF-8 without BOM. When editing an existing record use Edit on the specific lines, not a rewrite.

## Photos

1. The phone syncs raw photos into `Inventory_Photos` with names like `20260530_144600.jpg`. Raw = name matches `^\d{8}_\d{6}\.jpg$`.
2. For each item take the raw files newer than the previous item (check `LastWriteTime`). Look at them (Read the image) to propose `Name`, `Type` and `Category`.
3. Rename the first photo to `<Id>_<Name_with_underscores>.jpg` (letters, digits, underscore; no spaces). Extra photos get suffix `_2`, `_3`. Put only the first file name in `Photo`.
4. If there is no new raw photo, ask once; the item can be recorded without `Photo`.

## Flow per item

1. Ask which mode, unless obvious: **returning** (item already has an Id and `In Hands`) or **new**.
2. **Returning**: find the folder by Id or Name (Grep `Name:` in the records). Read it. Ask what changed (count, damage, where it is now).
3. **New**: ask the name (or propose it from the photo), `Quantity`, `Owner`, `Donated by`, where it is placed. Choose `Type`/`Category`, compute the Id by the scheme, show `Id + Name + Type + Category` and wait for a yes.
4. Fill `Container` (box or shelf code such as `16A`, `17D`; shelf numbers are Ids 10-19) and `StorageGuidelines`.
5. Set:
   - `Holder`: the storage site. Default `Aurora`; ask only if the user says another one (`EuropeanFoods`, `KennasBasement`).
   - `status`: `At Storage` if Name, Type, Quantity, Holder, Main_Location and Description are all filled; otherwise `For review` and say in `Log` what is missing.
   - `Last update`: today.
   - `Log`: append one line, e.g. `Borys checked in 11/7/2026, 2 cracks on the bottom`.
   - `Damages`: append, never delete old damages.
6. Write the record. For a **new** item also create the folder and append one line to `New_items.tsv`.
7. Reply with one line: Id, Name, status, photo file. Then ask for the next item.

## New_items.tsv

Tab-separated, UTF-8, no header, one line per new item, columns in the order of the sheet:

`Id, Name, Status, Type, Category, Quantity, Holder, Container, StorageGuidelines, Main_Location, Photo, Last update, Log, Description, Damages, Owner, Checklist, Donated by, Registered`

Empty values stay empty (keep the tabs). Replace line breaks inside a value with ` / `. The `URL` and `QR Code URL` sheet columns are left out. The user pastes the file under the last row of the Inventory sheet.

## Why new items need the sheet first

kbgate `push` for Google Sheets writes only changed cells of existing rows; it never creates rows. A new folder alone does not reach the server. After the visit the user pastes `New_items.tsv` into the sheet, then runs in `C:\Users\BorysLebeda\inventory`:

```
pull gtable UDS_Files\Inventory\UDS_Storage\Inventory -d
pull gtable UDS_Files\Inventory\UDS_Storage\Inventory
```

Changes to existing records are sent with `push gtable UDS_Files\Inventory\UDS_Storage\Inventory\<Id> --dry-run`, then the same without `--dry-run`. `Push: true` in `gtable.remote.yml` and `auth gsheets --write` are required first.

## End of the visit

Print a short summary: records changed, records created (with Ids), photos renamed, items recorded as `For review` and why. Remind the user to paste `New_items.tsv` into the sheet before any `pull`, because `pull` overwrites local files. Remind them that photos are not uploaded by kbgate (only the file name is in `Photo`).
