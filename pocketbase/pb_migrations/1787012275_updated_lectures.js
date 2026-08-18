/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_595999177")

  // add field
  collection.fields.addAt(5, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor1739553647",
    "maxSize": 0,
    "name": "content_rich",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_595999177")

  // remove field
  collection.fields.removeById("editor1739553647")

  return app.save(collection)
})
