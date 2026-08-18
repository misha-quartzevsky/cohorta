/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_595999177")

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "file2359244304",
    "maxSelect": 99,
    "maxSize": 0,
    "mimeTypes": [],
    "name": "file",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_595999177")

  // remove field
  collection.fields.removeById("file2359244304")

  return app.save(collection)
})
