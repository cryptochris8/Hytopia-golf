# Project Context for Claude

## Important Notes

### Testing Environment
- **Bun is no longer used for local testing** - It has been removed from the Hytopia SDK
- Use `hytopia start` command to run the local server
- Server runs at https://localhost:8080
- If you encounter issues with old Bun installation, remove `C:\Users\chris\.bun\bin\hytopia.exe`

### How to Start Local Server
1. Ensure Hytopia CLI is installed: `npm install -g hytopia@latest`
2. Run: `hytopia start`
3. Open browser at https://localhost:8080 to trust SSL certificate
4. Connect from https://hytopia.com/play using server URL: https://localhost:8080

## Project Information
- This is a Hytopia Golf Game project
- Platform: Windows (win32)
- Current branch: master