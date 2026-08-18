/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_955655590")

  // add field
  collection.fields.addAt(4, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3395098727",
    "hidden": false,
    "id": "relation3309463872",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "semesters",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_955655590")

  // remove field
  collection.fields.removeById("relation3309463872")

  return app.save(collection)
})
