#!/bin/bash

# Script to generate missing package-lock.json files for all services
set -e

echo "🔧 Generating missing package-lock.json files..."

# Function to generate package-lock.json for a service
generate_package_lock() {
    local service_dir="$1"
    local service_name=$(basename "$service_dir")
    
    if [ -f "$service_dir/package.json" ]; then
        echo "📦 Processing $service_name..."
        
        if [ -f "$service_dir/package-lock.json" ]; then
            echo "  ✓ package-lock.json already exists"
        else
            echo "  🔄 Generating package-lock.json..."
            cd "$service_dir"
            
            # Try npm install first, fallback to npm ci if it fails
            if npm install --package-lock-only --no-audit --no-fund; then
                echo "  ✅ Successfully generated package-lock.json"
            else
                echo "  ⚠️  npm install failed, trying alternative approach..."
                # Remove node_modules if it exists and try again
                rm -rf node_modules
                npm install --package-lock-only --no-audit --no-fund || {
                    echo "  ❌ Failed to generate package-lock.json for $service_name"
                    return 1
                }
                echo "  ✅ Successfully generated package-lock.json (retry)"
            fi
            
            cd - > /dev/null
        fi
    else
        echo "  ❌ No package.json found in $service_name"
        return 1
    fi
}

# Process all services
for service_dir in services/*/; do
    if [ -d "$service_dir" ]; then
        generate_package_lock "$service_dir"
    fi
done

echo ""
echo "🎉 Package-lock.json generation complete!"
echo ""
echo "📊 Summary:"
for service_dir in services/*/; do
    if [ -d "$service_dir" ]; then
        service_name=$(basename "$service_dir")
        if [ -f "$service_dir/package.json" ]; then
            if [ -f "$service_dir/package-lock.json" ]; then
                echo "  ✅ $service_name: package.json + package-lock.json"
            else
                echo "  ❌ $service_name: package.json only (missing package-lock.json)"
            fi
        else
            echo "  ❌ $service_name: missing package.json"
        fi
    fi
done