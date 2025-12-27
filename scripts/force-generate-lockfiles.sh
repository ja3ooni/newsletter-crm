#!/bin/bash

# Force Generate Proper Package Lock Files
# This script forces npm to generate proper package-lock.json files

set -e

echo "🔧 Force generating proper package-lock.json files..."

# Function to force generate package-lock.json for a service
force_generate_lockfile() {
    local service_dir="$1"
    local service_name=$(basename "$service_dir")
    
    if [ -f "$service_dir/package.json" ]; then
        echo "📦 Force generating lockfile for $service_name..."
        
        # Change to service directory
        cd "$service_dir"
        
        # Remove existing files that might interfere
        rm -f package-lock.json
        rm -rf node_modules
        
        # Clear npm cache for this directory
        npm cache clean --force 2>/dev/null || true
        
        # Force generate package-lock.json
        # Use --package-lock-only to avoid installing node_modules
        npm install --package-lock-only --no-audit --no-fund --force
        
        if [ -f "package-lock.json" ]; then
            echo "  ✅ Generated lockfile for $service_name ($(wc -l < package-lock.json) lines)"
        else
            echo "  ❌ Failed to generate lockfile for $service_name"
            # Try alternative approach - install then remove node_modules
            echo "  🔄 Trying alternative approach..."
            npm install --no-audit --no-fund
            if [ -f "package-lock.json" ]; then
                echo "  ✅ Generated lockfile for $service_name via install ($(wc -l < package-lock.json) lines)"
                # Remove node_modules to keep directory clean
                rm -rf node_modules
            else
                echo "  ❌ Alternative approach also failed for $service_name"
            fi
        fi
        
        # Return to root directory
        cd - > /dev/null
    else
        echo "  ⚠️  No package.json found in $service_name, skipping"
    fi
}

# Store current directory
ORIGINAL_DIR=$(pwd)

# Process each service directory
echo "🔍 Processing service directories..."
for service_dir in services/*/; do
    if [ -d "$service_dir" ]; then
        force_generate_lockfile "$service_dir"
    fi
done

# Process frontend directory if it exists
if [ -d "frontend" ]; then
    echo "Processing frontend..."
    force_generate_lockfile "frontend"
fi

# Return to original directory
cd "$ORIGINAL_DIR"

echo "✅ Package lock file generation completed!"
echo ""
echo "📋 Verifying generated files..."
for service_dir in services/*/; do
    if [ -d "$service_dir" ] && [ -f "$service_dir/package.json" ]; then
        service_name=$(basename "$service_dir")
        if [ -f "$service_dir/package-lock.json" ]; then
            lines=$(wc -l < "$service_dir/package-lock.json")
            if [ "$lines" -gt 10 ]; then
                echo "  ✅ $service_name: $lines lines (good)"
            else
                echo "  ⚠️  $service_name: $lines lines (minimal)"
            fi
        else
            echo "  ❌ $service_name: missing lockfile"
        fi
    fi
done

if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    if [ -f "frontend/package-lock.json" ]; then
        lines=$(wc -l < "frontend/package-lock.json")
        if [ "$lines" -gt 10 ]; then
            echo "  ✅ frontend: $lines lines (good)"
        else
            echo "  ⚠️  frontend: $lines lines (minimal)"
        fi
    else
        echo "  ❌ frontend: missing lockfile"
    fi
fi

echo ""
echo "🔄 Next steps:"
echo "  1. Commit the new package-lock.json files"
echo "  2. Push to trigger GitHub Actions"
echo "  3. Monitor workflow results"