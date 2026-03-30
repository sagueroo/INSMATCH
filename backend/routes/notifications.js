const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentUser } = require('./auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', getCurrentUser, async (req, res) => {
  try {
    const list = await prisma.notification.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    res.json({
      notifications: list.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        groupEventId: n.group_event_id,
        joinRequestId: n.join_request_id,
        createdAt: n.created_at.toISOString(),
      })),
      unreadCount: list.filter((n) => !n.read).length,
    });
  } catch (e) {
    res.status(500).json({ detail: 'Erreur notifications.' });
  }
});

router.patch('/:id/read', getCurrentUser, async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, user_id: req.user.id },
    data: { read: true },
  });
  res.json({ ok: true });
});

module.exports = router;
