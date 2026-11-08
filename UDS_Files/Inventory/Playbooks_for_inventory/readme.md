---
_webLink: https://docs.google.com/document/d/1ir7KqLKwIF_7HDRCzQc0-y7zxHx58mnTEa851BO4WZ8/edit
---

# Playbooks for inventory

## Guideline for visiting the storage room

1. You need to apply code two times - at the entrance and elevator. The code is the same  
2. If you have items to check in / donate - follow guidelines for checking  
3. If you have items to check out - follow guidelines for checkout  
4. If you volunteer to bring order follow the guidelines for bringing the order

## How to get to the storage

1. Enter through the freight entrance.
2. Turn right.
3. Use only elevators 1 and 2. Do not use elevator 3: it belongs to another building.
4. Go up to the third floor.
5. Find the unit F166 (Latin letter F, no hyphen, no spaces).

The unit is 300 cm (about 118 in) wide, from the left wall to the right wall, and 283-285 cm (about 112 in) deep, from the door to the back wall. The door is wide.

## Opening the door

2057 is our new unit  
Apply code to open the box. The lock code is 3761  
Use the key with the metal

## Check-in

Check-in is the operation of putting an item into the storage and making sure the Inventory record matches reality.

There are two cases:

- **Returning item** - the item already has an Id and its status is `In Hands` (someone took it for an event and brings it back).
- **New item / donation** - the item has no record yet. It starts with the status `For review`.

An item is available for checkout only when its status is `At Storage`.

### Before you start

- Have a phone for photos and access to the Inventory sheet.
- Bring a tape measure (to measure boxes), a headlamp (flashlight on a headband, so both hands stay free), the sheet of inventory number stickers, a marker, and a few spare totes or bags for small items.
- Know the Id of the item. For a returning item look it up by Name or Id. For a new item, never reuse an existing Id.

### Id numbering

The first digit of the Id is the category. Take the next free number in the group:

| Id | Category |
|---|---|
| 10-19 | Furniture, shelves, floor (19 = floor) |
| 2xx | Goods / auction items |
| 3xx | Banquet (items and their containers) |
| 4xx | Rally and Events |
| 5xx | Marketing and printed material |
| 6xx | Military and Medical |
| 7xx | Office |
| 8xx | Containers (boxes, totes, suitcases) of any category except Banquet |
| 9xx | Uncategorized |

Zero is never used as a first digit. Items registered before this scheme keep their old Ids.

### Steps for a returning item

1. Find the record. Check that `Holder` is you (or the person who brings the item) and the status is `In Hands`.
2. Compare the item with `Description` and `Checklist`. Count `Quantity`. For a `Set`, make sure every part is present (e.g. speaker, both microphones, manual).
3. Look for damage. If there is anything new, add it to `Damages` (what is damaged and where). Do not delete old damages.
4. Put the item into the storage and write where it is:
   - `Container` - the code of the box or tote if it lies inside one (e.g. `16A`, `17D`),
   - `StorageGuidelines: Where we can find it?` - a plain sentence (e.g. "On the top shelf, microphones are in a paper box").
5. Update the record:
   - `Holder` - the storage where the item stays (`Aurora` by default; `EuropeanFoods` and `KennasBasement` are other sites),
   - `Quantity` - the real quantity after the return,
   - `Status` - `At Storage`,
   - `Last update` - today's date,
   - `Log` - one line: who returned it, when, and what changed (e.g. "Borys returned after rally 4/11, remote control still missing").
6. If the item is not complete or something is unclear, set `Status` to `For review` and explain in `Log`.

### Steps for a new item / donation

1. Take the next free Id and create a new record.
2. Fill in the required fields:
   - `Name` - short and specific,
   - `Type` - one of `Asset`, `AuctionItem`, `Container`, `Expendables`, `PrintedMaterial`, `Set`, `Unknown`. If you are not sure, use `Unknown`,
   - `Category` - see the list in the Categories sheet. If you are not sure, use `Uncategorized`,
   - `Quantity`,
   - `Holder` and `Main_Location` (`Seattle`, `Tacoma`, `EastSide` or `Other`),
   - `Owner` - `UDS` or the person who lends the item,
   - `Donated by` - the donor, if there is one,
   - `Registered` - today's date,
   - `Description` - what it is, what it consists of, anything useful for the next person.
3. Take photos (see "Photos") and fill in `Photo`.
4. Describe the condition in `Damages` if there are any.
5. Put the item into the storage, then fill in `Container` and `StorageGuidelines: Where we can find it?` as described above.
6. Write the first line in `Log` (e.g. "Donated by Anna, checked in 11/07/2026").
7. Set `Status`:
   - `At Storage` - if all required information is filled,
   - `For review` - if something is missing. Write what exactly is missing in `Log`.
8. Set `Last update` to today's date.

### Items that hold other items

A box, tote or suitcase is a `Container` and is tracked as a separate record. Items inside get its code in the `Container` field. Expendables inside a box are tracked separately from the box.

### Inventory stickers

- Every item and every container gets a sticker with its Id.
- We use ordinary US address labels (the ones for envelopes, sold as "address labels"). One sheet has 14 labels in 2 columns by 7 rows. They are small and can be stuck on almost any item.
- Write the Id on the label with a marker, large and legible.
- Stick it where it can be seen without moving the item: on a box, on the front side and on the lid. On a shelf, at the front edge.
- Keep small items together. Put them into one tote or box, give the container the sticker and its own record, and set the `Container` field of every item inside it. Do not leave small items loose on a shelf, even with a sticker.

### Shelves are inventoried too

- Every shelf is an item of its own: `Type` Container, `Category` Furniture, Id 10-19, with a sticker on the shelf (the top level, front).
- All shelves are the same size: 3 ft wide, 1.5 ft deep, 6 ft high, which is `Dimensions: 91 x 46 x 183 cm` (width x depth x height). Put this line first in `Description`.
- Write in `Description` what it is and where it was bought (e.g. "Black plastic shelf, bought at Costco") and its level letters (A from the top).
- Take two photos: the empty shelf and, later, the full one. The second photo gets the suffix `_2`.
- The things on a shelf get its code in `Container`, level included (e.g. `16B`).

### Dimensions

- Measure every box, tote and suitcase with the tape measure: length x width x height, always in centimeters (e.g. `Dimensions: 46 x 30 x 25 cm`).
- Write the line at the beginning of `Description`. Large items (tables, shelves, banners) get dimensions too. Small items do not need them.

### Moving items from another location

Use this when items are brought from an old storage (e.g. shelves taken apart and carried by car).

- Check every item in as a returning item or as a new one, the same way as above.
- Add one `Log` line: where it came from, the date, who moved it (e.g. "Moved from the old storage 11/7/2026 by Borys and John").
- Keep the shelf Id and the `Container` codes of the items on it, so the contents stay together after the move.
- Planning note: two people took two shelves apart and carried them out in about one hour. The contents of both shelves fit into a Honda Odyssey.

### Photos

- Take at least one clear photo of the whole item. Add a close-up for damages and labels.
- Name the file `<Id>_<Name_with_underscores>.jpg`, e.g. `148_Karaoke_Speaker.jpg`.
- Put the file into `Inventory_Photos` and write the file name in the `Photo` field.

### Final check

- The item is physically in the storage and the door is locked.
- The record has the right `Status`, `Holder`, `Container` and `Last update`.
- `Log` has a line about this check-in.
