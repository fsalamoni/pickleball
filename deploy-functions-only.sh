#!/bin/bash
# Deploy SÓ das Cloud Functions
set -e
cd ~/pickleball
firebase deploy --only functions --project antonov-82411
