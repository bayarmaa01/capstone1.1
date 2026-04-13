# Manual Moodle Attendance Plugin Upgrade Guide

## Current Situation
- **Current Version**: 2023020109
- **Required Version**: 2026012700
- **Status**: Moodle upgrade blocked until plugin is updated

## Manual Upgrade Steps

### Step 1: Download Latest Plugin

**Option A: Moodle Plugins Repository**
1. Visit: https://moodle.org/plugins/mod_attendance
2. Click "Download" button
3. Download the latest version compatible with Moodle 5.0+

**Option B: Direct Download**
1. Download from: https://github.com/danmarsden/moodle-mod_attendance
2. Click "Code" > "Download ZIP"
3. Save as `attendance.zip`

**Option C: Using wget on Azure VM**
```bash
cd ~/capstone1.1/moodle/mod
wget https://github.com/danmarsden/moodle-mod_attendance/archive/refs/heads/master.zip
unzip master.zip
mv mod_attendance-master attendance
rm master.zip
```

### Step 2: Backup Current Plugin
```bash
cd ~/capstone1.1/moodle/mod
sudo mv attendance attendance_backup_$(date +%Y%m%d_%H%M%S)
```

### Step 3: Install New Plugin
```bash
# Extract the downloaded plugin
unzip attendance.zip
mv mod_attendance-master attendance

# Set proper permissions
sudo chown -R www-data:www-data attendance
sudo chmod -R 755 attendance
```

### Step 4: Restart Moodle
```bash
cd ~/capstone1.1
docker compose restart moodle
```

### Step 5: Complete Moodle Upgrade
1. Access: http://attendance-ml.duckdns.org/moodle/
2. Login as administrator
3. Go to: Site administration > Notifications
4. Click "Upgrade Moodle database now"
5. Follow the upgrade steps

### Step 6: Verify Plugin
1. Go to: Site administration > Plugins > Activity modules > Manage activities
2. Check "Attendance" is listed and enabled
3. Verify version shows 2026012700

## Troubleshooting

### If Download Fails
```bash
# Try curl instead of wget
curl -L -o attendance.zip https://github.com/danmarsden/moodle-mod_attendance/archive/refs/heads/master.zip
```

### If Permissions Issues
```bash
# Reset permissions
sudo chown -R www-data:www-data moodle/mod/attendance
sudo chmod -R 755 moodle/mod/attendance
```

### If Moodle Doesn't Detect Plugin
```bash
# Clear Moodle cache
docker exec capstone11-moodle-1 php admin/cli/purge_caches.php

# Check plugin directory
docker exec capstone11-moodle-1 ls -la /var/www/html/mod/attendance/
```

### If Upgrade Fails
```bash
# Check Moodle logs
docker logs capstone11-moodle-1

# Check plugin version
docker exec capstone11-moodle-1 cat /var/www/html/mod/attendance/version.php
```

## Expected Result
- Attendance plugin version: 2026012700
- Moodle upgrade completes successfully
- Attendance activity available in courses

## Alternative: Skip Plugin Upgrade
If unable to upgrade the plugin, you can temporarily disable it:
```bash
cd ~/capstone1.1/moodle/mod
sudo mv attendance attendance_disabled
```

Then complete Moodle upgrade and re-enable the plugin later.
