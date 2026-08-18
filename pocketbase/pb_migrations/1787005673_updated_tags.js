/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1219621782")

  // add field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_595999177",
    "hidden": false,
    "id": "relation1674076624",
    "maxSelect": 999,
    "minSelect": 0,
    "name": "lectures",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1219621782")

  // remove field
  collection.fields.removeById("relation1674076624")

  return app.save(collection)
})
