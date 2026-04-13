#!/bin/bash

# Moodle Attendance Plugin Upgrade Script
# Upgrades attendance plugin from 2023020109 to 2026012700

set -e

echo "=== MOODLE ATTENDANCE PLUGIN UPGRADE ==="
echo "Current version: 2023020109"
echo "Target version: 2026012700"
echo

# STEP 1: Check current plugin status
echo "1. Checking current plugin status..."
if [ -d "moodle/mod/attendance" ]; then
    echo "Current attendance plugin found"
    echo "Current version file:"
    cat moodle/mod/attendance/version.php 2>/dev/null | grep "version" || echo "Version file not found"
else
    echo "No attendance plugin found - will install fresh"
fi
echo

# STEP 2: Download latest attendance plugin
echo "2. Downloading latest attendance plugin..."
cd moodle/mod

# Backup current plugin if it exists
if [ -d "attendance" ]; then
    echo "Backing up current plugin..."
    sudo mv attendance attendance_backup_$(date +%Y%m%d_%H%M%S)
fi

# Download latest attendance plugin from Moodle plugins repository
echo "Downloading attendance plugin version 2026012700..."
wget -O attendance.zip "https://moodle.org/plugins/download.php/26270/mod_attendance_moodle50_2026012700.zip" || {
    echo "Direct download failed, trying alternative source..."
    # Alternative download from GitHub
    wget -O attendance.zip "https://github.com/danmarsden/moodle-mod_attendance/archive/refs/heads/master.zip" || {
        echo "Download failed, trying manual approach..."
        echo "Please download the attendance plugin manually from:"
        echo "https://moodle.org/plugins/mod_attendance"
        echo "And extract to moodle/mod/attendance/"
        exit 1
    }
}

# Extract the plugin
echo "Extracting plugin..."
unzip -q attendance.zip
if [ -d "mod_attendance-master" ]; then
    mv mod_attendance-master attendance
elif [ -d "attendance" ]; then
    echo "Plugin already extracted"
else
    echo "Unknown extraction structure, checking contents..."
    ls -la
    echo "Please manually extract the attendance plugin to moodle/mod/attendance/"
    exit 1
fi

# Remove zip file
rm attendance.zip

# Check new plugin version
echo "3. Checking new plugin version..."
if [ -f "attendance/version.php" ]; then
    NEW_VERSION=$(grep "version" attendance/version.php | grep -o "[0-9]\{10\}" | head -1)
    echo "New plugin version: $NEW_VERSION"
    if [ "$NEW_VERSION" = "2026012700" ]; then
        echo "Correct version downloaded!"
    else
        echo "Warning: Downloaded version $NEW_VERSION, expected 2026012700"
    fi
else
    echo "Warning: Could not verify new plugin version"
fi

# Set proper permissions
echo "4. Setting proper permissions..."
cd ../../
sudo chown -R www-data:www-data moodle/mod/attendance
sudo chmod -R 755 moodle/mod/attendance
echo

# STEP 5: Restart Moodle container
echo "5. Restarting Moodle container..."
docker compose restart moodle
echo "Waiting for Moodle to start..."
sleep 10

# STEP 6: Check Moodle upgrade status
echo "6. Checking Moodle upgrade status..."
docker exec capstone11-moodle-1 php admin/upgrade.php --non-interactive || echo "Manual upgrade may be required"

echo
echo "=== UPGRADE COMPLETE ==="
echo "Next steps:"
echo "1. Access Moodle at http://attendance-ml.duckdns.org/moodle/"
echo "2. Login as administrator"
echo "3. Go to Site administration > Notifications"
echo "4. Complete the database upgrade if prompted"
echo "5. Verify attendance plugin is working"
echo
echo "If issues persist, check Moodle logs:"
echo "docker logs capstone11-moodle-1"
