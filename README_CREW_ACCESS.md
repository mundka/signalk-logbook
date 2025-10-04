# 🚢 Ship's Crew Access Control System

## Overview

This Signal K logbook system implements a comprehensive role-based access control system designed for maritime operations. The system follows proper ship's crew hierarchy with appropriate permissions for each role.

## Created User Accounts

| Username | Role | Access Level | Password | Permissions |
|----------|------|--------------|----------|-------------|
| `admin` | Admin | Full Access | `admin` | All features, user management |
| `captain` | Captain | Full Access | `admin` | All features, delete entries |
| `chief_officer` | Chief Officer | Read/Write | `admin` | Logbook, Reports, delete entries |
| `officer` | Officer | Read/Write | `admin` | Logbook, Reports |
| `engineer` | Engineer | Read/Write | `admin` | Logbook, Service, Reports |
| `bosun` | Bosun | Read Only | `admin` | View logbook, map |
| `crew` | Crew | Read Only | `admin` | View logbook, map |

## Access Rights by Role

### 👑 Captain & Admin
- ✅ Create/Edit/Delete logbook entries
- ✅ Access all tabs (Logbook, Map, Service, Reports)
- ✅ Delete any entry
- ✅ Full system access

### ⚓ Chief Officer
- ✅ Create/Edit logbook entries
- ✅ Access Logbook, Map, Reports
- ✅ Delete entries
- ❌ No Service tab access

### 🧭 Officer
- ✅ Create/Edit logbook entries
- ✅ Access Logbook, Map, Reports
- ❌ Cannot delete entries
- ❌ No Service tab access

### 🔧 Engineer
- ✅ Create/Edit logbook entries
- ✅ Access Logbook, Map, Service, Reports
- ❌ Cannot delete entries

### ⚓ Bosun & Crew
- ✅ View logbook entries
- ✅ Access Logbook, Map
- ❌ Cannot create/edit entries
- ❌ No Service or Reports access

## Detailed Permission Matrix

| Feature | Captain | Chief Officer | Officer | Engineer | Bosun | Crew |
|---------|---------|---------------|---------|----------|-------|------|
| View Logbook | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Entries | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Entries | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete Entries | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Map View | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reports Tab | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Service Tab | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## How to Use

### 1. Access the System
- **URL**: http://localhost:3000/admin
- **Login** with any of the accounts listed above
- **Default password** for all accounts: `admin`

### 2. Testing Different Roles
1. Login with different accounts to test permissions
2. Notice the role indicator in the logbook interface
3. Try different actions based on role permissions
4. Observe how UI elements change based on access rights

### 3. Managing Users (Admin/Captain only)
1. Go to Signal K Admin → Security → Users
2. Add/Edit/Delete user accounts
3. Modify passwords and roles as needed
4. Configure additional ACL permissions if required

## Security Features

### 🔐 Authentication
- **Token-based security** via Signal K's native system
- **Bcrypt password hashing** for secure storage
- **Session management** with configurable expiration

### 🛡️ Authorization
- **Role-based access control (RBAC)**
- **Access Control Lists (ACLs)** for fine-grained permissions
- **Plugin-specific permissions** for logbook features
- **UI-level restrictions** based on user roles

### 🚫 Security Measures
- **New user registration disabled** by default
- **Read-only access** for lower-level crew
- **Entry deletion restrictions** by role hierarchy
- **Tab access control** for sensitive features

## Technical Implementation

### Files Modified
- `/home/node/.signalk/security.json` - User accounts and ACL configuration
- `src/components/AppPanel.jsx` - Role-based UI logic and user info fetching
- `src/components/Logbook.jsx` - Conditional editing and role display

### Key Functions
- `getUserRole()` - Retrieves current user's role
- `canWriteEntries()` - Checks write permissions
- `canDeleteEntries()` - Checks delete permissions
- `canAccessReports()` - Checks reports access
- `canAccessService()` - Checks service access

### ACL Configuration
```json
{
  "context": "vessels.self",
  "resources": [
    {
      "paths": ["*"],
      "permissions": [
        {"subject": "captain", "permission": "admin"},
        {"subject": "officer", "permission": "write"},
        {"subject": "crew", "permission": "read"}
      ]
    }
  ]
}
```

## Production Deployment

### Security Checklist
- [ ] Change all default passwords
- [ ] Review and adjust user roles as needed
- [ ] Configure proper SSL/TLS certificates
- [ ] Set up regular security audits
- [ ] Implement password complexity requirements
- [ ] Configure session timeout policies

### User Management
- [ ] Create accounts for actual crew members
- [ ] Assign appropriate roles based on ship hierarchy
- [ ] Document access procedures for crew
- [ ] Set up password recovery procedures
- [ ] Regular access review and cleanup

## Troubleshooting

### Common Issues
1. **User can't login**: Check username/password, verify account exists in security.json
2. **Missing permissions**: Review ACL configuration and user role assignment
3. **UI elements not showing**: Check role-based conditional rendering in components
4. **Server restart required**: After security.json changes, restart Signal K container

### Logs and Debugging
- **Signal K logs**: `docker logs signalk-dev`
- **Browser console**: Check for authentication errors
- **Network tab**: Verify API calls and responses
- **User info endpoint**: `/signalk/v1/auth/user`

## Support

For issues or questions regarding the crew access control system:
1. Check Signal K documentation for authentication
2. Review the security.json configuration
3. Verify user roles and permissions in the admin interface
4. Test with different user accounts to isolate issues

---

**Last Updated**: October 2025  
**Version**: 1.0  
**Compatible with**: Signal K Server v2.x, signalk-logbook plugin
