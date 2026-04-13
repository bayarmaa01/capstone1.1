const express = require('express');
const router = express.Router();
const lmsSyncService = require('../services/lms_sync');

// Manual sync trigger for students
router.post('/students', async (req, res) => {
  try {
    console.log('Manual student sync triggered');
    await lmsSyncService.syncStudents();
    res.json({ 
      success: true, 
      message: 'Student synchronization completed successfully' 
    });
  } catch (error) {
    console.error('Manual student sync error:', error);
    res.status(500).json({ 
      error: 'Student synchronization failed',
      details: error.message 
    });
  }
});

// Manual sync trigger for courses
router.post('/courses', async (req, res) => {
  try {
    console.log('Manual course sync triggered');
    await lmsSyncService.syncCourses();
    res.json({ 
      success: true, 
      message: 'Course synchronization completed successfully' 
    });
  } catch (error) {
    console.error('Manual course sync error:', error);
    res.status(500).json({ 
      error: 'Course synchronization failed',
      details: error.message 
    });
  }
});

// Full sync (courses + students)
router.post('/all', async (req, res) => {
  try {
    console.log('Manual full sync triggered');
    await lmsSyncService.syncCourses();
    await lmsSyncService.syncStudents();
    res.json({ 
      success: true, 
      message: 'Full synchronization completed successfully' 
    });
  } catch (error) {
    console.error('Manual full sync error:', error);
    res.status(500).json({ 
      error: 'Full synchronization failed',
      details: error.message 
    });
  }
});

// Get sync status
router.get('/status', async (req, res) => {
  try {
    const isRunning = lmsSyncService.isRunning;
    res.json({ 
      success: true, 
      isRunning,
      message: isRunning ? 'Sync is currently running' : 'Sync is idle'
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ 
      error: 'Failed to get sync status',
      details: error.message 
    });
  }
});

module.exports = router;
