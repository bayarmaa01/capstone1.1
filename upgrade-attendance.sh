#!/bin/bash

# Simple Moodle Attendance Plugin Upgrade Script
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
    if [ -f "moodle/mod/attendance/version.php" ]; then
        CURRENT_VERSION=$(grep "version" moodle/mod/attendance/version.php | grep -o "[0-9]\{10\}" | head -1)
        echo "Current version: $CURRENT_VERSION"
    fi
else
    echo "No attendance plugin found - will install fresh"
fi
echo

# STEP 2: Create backup if plugin exists
echo "2. Creating backup..."
if [ -d "moodle/mod/attendance" ]; then
    BACKUP_DIR="moodle/mod/attendance_backup_$(date +%Y%m%d_%H%M%S)"
    sudo mv moodle/mod/attendance "$BACKUP_DIR"
    echo "Backup created: $BACKUP_DIR"
fi
echo

# STEP 3: Download latest attendance plugin
echo "3. Downloading latest attendance plugin..."
cd moodle/mod

# Try different download methods
echo "Attempting download from GitHub..."
if command -v wget &> /dev/null; then
    # Try GitHub download
    wget -O attendance.zip "https://github.com/danmarsden/moodle-mod_attendance/archive/refs/heads/master.zip" 2>/dev/null || {
        echo "GitHub download failed, trying curl..."
        if command -v curl &> /dev/null; then
            curl -L -o attendance.zip "https://github.com/danmarsden/moodle-mod_attendance/archive/refs/heads/master.zip" 2>/dev/null || {
                echo "Download failed - please download manually"
                echo "Visit: https://moodle.org/plugins/mod_attendance"
                echo "Download and extract to: moodle/mod/attendance/"
                exit 1
            }
        else
            echo "Neither wget nor curl available"
            echo "Please download manually from: https://moodle.org/plugins/mod_attendance"
            exit 1
        fi
    }
else
    echo "wget not available, trying curl..."
    if command -v curl &> /dev/null; then
        curl -L -o attendance.zip "https://github.com/danmarsden/moodle-mod_attendance/archive/refs/heads/master.zip" 2>/dev/null || {
        echo "Download failed - please download manually"
        echo "Visit: https://moodle.org/plugins/mod_attendance"
        echo "Download and extract to: moodle/mod/attendance/"
        exit 1
    }
    else
        echo "Neither wget nor curl available"
        echo "Please download manually from: https://moodle.org/plugins/mod_attendance"
        exit 1
    fi
fi

# STEP 4: Extract plugin
echo "4. Extracting plugin..."
if [ -f "attendance.zip" ]; then
    unzip -q attendance.zip
    if [ -d "moodle-mod_attendance-master" ]; then
        mv moodle-mod_attendance-master attendance
        echo "Plugin extracted successfully"
    elif [ -d "mod_attendance-master" ]; then
        mv mod_attendance-master attendance
        echo "Plugin extracted successfully"
    else
        echo "Unknown extraction structure"
        ls -la
        echo "Please manually extract to moodle/mod/attendance/"
        exit 1
    fi
    rm attendance.zip
else
    echo "attendance.zip not found"
    exit 1
fi

# STEP 5: Check new plugin version
echo "5. Checking new plugin version..."
if [ -f "attendance/version.php" ]; then
    NEW_VERSION=$(grep "version" attendance/version.php | grep -o "[0-9]\{10\}" | head -1)
    echo "New plugin version: $NEW_VERSION"
    if [ "$NEW_VERSION" = "2026012700" ] || [ "$NEW_VERSION" = "2024051500" ] || [ "$NEW_VERSION" = "2024051501" ]; then
        echo "Compatible version downloaded!"
    else
        echo "Version: $NEW_VERSION (should be compatible with Moodle 5.0)"
    fi
else
    echo "Warning: Could not verify new plugin version"
fi

# STEP 6: Set permissions
echo "6. Setting permissions..."
cd ../..
sudo chown -R www-data:www-data moodle/mod/attendance
sudo chmod -R 755 moodle/mod/attendance
echo "Permissions set"
echo

# STEP 7: Restart Moodle
echo "7. Restarting Moodle container..."
docker compose restart moodle
echo "Waiting for Moodle to start..."
sleep 10
echo

# STEP 8: Check Moodle status
echo "8. Checking Moodle status..."
docker ps | grep moodle || echo "Moodle container not running"
echo

echo "=== UPGRADE COMPLETE ==="
echo
echo "NEXT STEPS:"
echo "1. Access Moodle: http://attendance-ml.duckdns.org/moodle/"
echo "2. Login as administrator"
echo "3. Go to: Site administration > Notifications"
echo "4. Complete the database upgrade"
echo "5. Verify attendance plugin works"
echo
echo "If issues persist:"
echo "- Check Moodle logs: docker logs capstone11-moodle-1"
echo "- Clear Moodle cache: docker exec capstone11-moodle-1 php admin/cli/purge_caches.php"
echo "- Verify plugin: docker exec capstone11-moodle-1 ls -la /var/www/html/mod/attendance/"
