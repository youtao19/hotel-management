const express = require('express');
const controller = require('./roomTypeMapping.controller');

const router = express.Router();

router.get('/', controller.listMappings);
router.post('/refresh', controller.refreshRooms);
router.post('/', controller.saveMappings);
router.delete('/:localRoomType', controller.deleteMapping);

module.exports = router;
