#!/bin/bash

# Moodle Configuration Fix Script
echo "🔧 Moodle Configuration Fix Script"
echo "================================"

# Check if Moodle directory exists
if [ ! -d "/var/www/html" ]; then
    echo "❌ Moodle directory not found at /var/www/html"
    echo "🔍 Searching for Moodle installation..."
    
    # Find Moodle installation
    MOODLE_DIR=$(find /var/www -name "config.php" -o -name "config-dist.php" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
    
    if [ -n "$MOODLE_DIR" ]; then
        echo "✅ Found Moodle at: $MOODLE_DIR"
        HTML_DIR="$MOODLE_DIR"
    else
        echo "❌ No Moodle installation found"
        exit 1
    fi
else
    HTML_DIR="/var/www/html"
    echo "✅ Moodle directory found at /var/www/html"
fi

# Check for existing config files
echo "🔍 Checking for existing config files..."
if [ -f "$HTML_DIR/config.php" ]; then
    echo "✅ config.php already exists"
    echo "📋 Current permissions:"
    ls -la "$HTML_DIR/config.php"
    exit 0
fi

# Look for config template
if [ -f "$HTML_DIR/config-dist.php" ]; then
    echo "✅ Found config-dist.php template"
    CONFIG_TEMPLATE="$HTML_DIR/config-dist.php"
elif [ -f "$HTML_DIR/config.php.dist" ]; then
    echo "✅ Found config.php.dist template"
    CONFIG_TEMPLATE="$HTML_DIR/config.php.dist"
else
    echo "❌ No config template found"
    echo "🔍 Searching for Moodle template..."
    find /var/www -name "config*.php*" 2>/dev/null
    exit 1
fi

# Create config from template
echo "📝 Creating config.php from template..."
sudo cp "$CONFIG_TEMPLATE" "$HTML_DIR/config.php"

# Set proper permissions
echo "🔐 Setting permissions..."
sudo chown www-data:www-data "$HTML_DIR/config.php"
sudo chmod 640 "$HTML_DIR/config.php"

# Verify creation
echo "✅ Config file created successfully!"
echo "📋 New permissions:"
ls -la "$HTML_DIR/config.php"

echo ""
echo "🔧 Next Steps:"
echo "1. Edit $HTML_DIR/config.php with your database settings"
echo "2. Set proper database credentials"
echo "3. Configure Moodle URL and data directory"
echo "4. Restart web server: sudo systemctl restart apache2"
echo ""
echo "🚀 Moodle should be accessible after configuration!"
