#!/bin/bash

# Generate Proper Package Lock Files
# This script generates proper package-lock.json files with actual dependency information

set -e

echo "🔧 Generating proper package-lock.json files..."

# Function to generate package-lock.json for a service
generate_lockfile() {
    local service_dir="$1"
    local service_name=$(basename "$service_dir")
    
    if [ -f "$service_dir/package.json" ]; then
        echo "📦 Generating lockfile for $service_name..."
        
        # Remove existing minimal lockfile
        rm -f "$service_dir/package-lock.json"
        
        # Change to service directory
        cd "$service_dir"
        
        # Generate proper package-lock.json using npm install --package-lock-only
        # This creates the lockfile without installing node_modules
        npm install --package-lock-only --no-audit --no-fund
        
        if [ -f "package-lock.json" ]; then
            echo "  ✅ Generated lockfile for $service_name"
        else
            echo "  ❌ Failed to generate lockfile for $service_name"
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
        generate_lockfile "$service_dir"
    fi
done

# Process frontend directory if it exists
if [ -d "frontend" ]; then
    echo "Processing frontend..."
    generate_lockfile "frontend"
fi

# Return to original directory
cd "$ORIGINAL_DIR"

echo "✅ Package lock file generation completed!"
echo ""
echo "📋 Summary:"
echo "  - Generated proper package-lock.json files for all services"
echo "  - Files now contain complete dependency trees"
echo "  - Docker builds using 'npm ci' should now work"
echo ""
echo "🔄 Next steps:"
echo "  1. Commit the new package-lock.json files"
echo "  2. Push to trigger GitHub Actions"
echo "  3. Monitor workflow results"