const express = require('express');
const router = express.Router();
const { pluginAuth } = require('../plugin-auth.middleware');
const {
  listPluginRoomTypeMappings,
  createPluginRoomTypeMappings,
  updatePluginRoomTypeMappings
} = require('./room-map.controller');

router.get('/', pluginAuth, listPluginRoomTypeMappings);
router.post('/', pluginAuth, createPluginRoomTypeMappings);
router.put('/:id', pluginAuth, updatePluginRoomTypeMappings);

module.exports = router;
