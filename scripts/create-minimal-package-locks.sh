#!/bin/bash

# Script to create minimal package-lock.json files for Docker builds
set -e

echo "🔧 Creating minimal package-lock.json files for Docker builds..."

# Function to create a minimal package-lock.json
create_minimal_package_lock() {
    local service_dir="$1"
    local service_name=$(basename "$service_dir")
    
    if [ -f "$service_dir/package.json" ]; then
        if [ ! -f "$service_dir/package-lock.json" ]; then
            echo "📦 Creating minimal package-lock.json for $service_name..."
            
            # Read the package.json to get name and version
            local pkg_name=$(node -p "require('$service_dir/package.json').name")
            local pkg_version=$(node -p "require('$service_dir/package.json').version")
            
            # Create minimal package-lock.json
            cat > "$service_dir/package-lock.json" << EOF
{
  "name": "$pkg_name",
  "version": "$pkg_version",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "$pkg_name",
      "version": "$pkg_version",
      "license": "MIT",
      "dependencies": {},
      "devDependencies": {},
      "engines": {
        "node": ">=18.0.0"
      }
    }
  }
}
EOF
            echo "  ✅ Created minimal package-lock.json"
        else
            echo "📦 $service_name already has package-lock.json"
        fi
    else
        echo "❌ No package.json found in $service_name"
    fi
}

# Process all services
for service_dir in services/*/; do
    if [ -d "$service_dir" ]; then
        create_minimal_package_lock "$service_dir"
    fi
done

echo ""
echo "🎉 Minimal package-lock.json creation complete!"
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