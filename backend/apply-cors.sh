#!/bin/bash
# Load environment variables
source .env

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket besafe.backet \
  --cors-configuration file://tebi-cors-config.json \
  --endpoint-url https://s3.tebi.io \
  --profile tebi 2>/dev/null || \
AWS_ACCESS_KEY_ID=$STORAGE_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$STORAGE_SECRET_ACCESS_KEY \
aws s3api put-bucket-cors \
  --bucket besafe.backet \
  --cors-configuration file://tebi-cors-config.json \
  --endpoint-url https://s3.tebi.io

echo "CORS configuration applied successfully!"
