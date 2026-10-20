import re

with open('firestore.rules', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update validStudentSelfUpdate
old_student_keys = """          'watchProgress', 'completedItems', 'progress', 'lastActive', 'notifications',
          'track'
        ])"""

new_student_keys = """          'watchProgress', 'completedItems', 'progress', 'lastActive', 'notifications',
          'track', 'lastActiveMs', 'updatedAt', 'downloadedFilesCount'
        ])"""

assert old_student_keys in content, "old_student_keys not found"
content = content.replace(old_student_keys, new_student_keys, 1)

# 2. Update validWatchProgressWrite
old_wp_keys = "d.keys().hasOnly(['itemId', 'coveredSeconds', 'totalDuration', 'coverage', 'intervals', 'lastPosition', 'completed', 'updatedAt'])"
new_wp_keys = "d.keys().hasOnly(['itemId', 'coveredSeconds', 'totalDuration', 'coverage', 'intervals', 'lastPosition', 'completed', 'updatedAt', 'maxPlaybackRate', 'seekCount'])"

assert old_wp_keys in content, "old_wp_keys not found"
content = content.replace(old_wp_keys, new_wp_keys, 1)

old_wp_end = "&& (!('updatedAt' in d) || d.updatedAt is timestamp || d.updatedAt == request.time);"
new_wp_end = """&& (!('maxPlaybackRate' in d) || d.maxPlaybackRate is number)
            && (!('seekCount' in d) || d.seekCount is number)
            && (!('updatedAt' in d) || d.updatedAt is timestamp || d.updatedAt == request.time);"""

assert old_wp_end in content, "old_wp_end not found"
content = content.replace(old_wp_end, new_wp_end, 1)

# 3. Add downloadClicks subcollection rule
old_wp_block_end = """        allow create, update: if isAdmin()
          || (isSignedIn() && request.auth.uid == studentId && validWatchProgressWrite());
        allow delete: if isAdmin();
      }
    }"""

new_wp_block_end = """        allow create, update: if isAdmin()
          || (isSignedIn() && request.auth.uid == studentId && validWatchProgressWrite());
        allow delete: if isAdmin();
      }

      // تسجيل نقرات تحميل المذكرات والملفات
      match /downloadClicks/{fileId} {
        allow get, list: if isSignedIn() && (request.auth.uid == studentId || isAdmin());
        allow create, update: if isSignedIn() && request.auth.uid == studentId
          && request.resource.data.keys().hasOnly(['courseId', 'lectureId', 'fileId', 'clickedAt'])
          && request.resource.data.fileId == fileId;
        allow delete: if isAdmin();
      }
    }"""

assert old_wp_block_end in content, "old_wp_block_end not found"
content = content.replace(old_wp_block_end, new_wp_block_end, 1)

# 4. Add broadcast_notifications rule
old_sent_notif = """    match /sent_notifications/{notificationId} {
      allow read: if isAdmin();
      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly(['title', 'message', 'target', 'recipients', 'sentBy', 'sentAt'])
        && request.resource.data.title is string && request.resource.data.title.size() <= 100
        && request.resource.data.message is string && request.resource.data.message.size() <= 500
        && request.resource.data.target is string && request.resource.data.target.size() <= 120
        && request.resource.data.recipients is int
        && request.resource.data.sentAt == request.time;
      allow update, delete: if false;
    }"""

new_sent_notif = old_sent_notif + """

    // ---------- الإشعارات العامة المجمعة (Broadcast Notifications) ----------

    match /broadcast_notifications/{notificationId} {
      allow get, list: if isSignedIn();
      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly(['title', 'message', 'category', 'targetType', 'sentBy', 'createdAt', 'targetCourseId', 'targetSegment'])
        && request.resource.data.title is string && request.resource.data.title.size() <= 100
        && request.resource.data.message is string && request.resource.data.message.size() <= 1000
        && request.resource.data.category in ['platformUpdates', 'curriculumUpdates', 'laggingWarnings'];
      allow update, delete: if isAdmin();
    }"""

assert old_sent_notif in content, "old_sent_notif not found"
content = content.replace(old_sent_notif, new_sent_notif, 1)

# 5. Add notificationSwitches to settings
old_settings = """    match /settings/{settingId} {
      allow get: if true;
      allow list: if isAdmin();
      allow create, update: if isAdmin()
        && settingId == 'contentRules'
        && request.resource.data.keys().hasOnly(['enabled', 'enabledAt', 'watchThreshold', 'updatedAt'])
        && request.resource.data.enabled is bool
        && (!('enabledAt' in request.resource.data) || request.resource.data.enabledAt is number || request.resource.data.enabledAt == null)
        && (!('watchThreshold' in request.resource.data) || (request.resource.data.watchThreshold is number && request.resource.data.watchThreshold >= 0.0 && request.resource.data.watchThreshold <= 1.0));
      allow delete: if false;
    }"""

new_settings = """    match /settings/{settingId} {
      allow get: if true;
      allow list: if isAdmin();
      allow create, update: if isAdmin()
        && (
          (settingId == 'contentRules'
            && request.resource.data.keys().hasOnly(['enabled', 'enabledAt', 'watchThreshold', 'updatedAt'])
            && request.resource.data.enabled is bool
            && (!('enabledAt' in request.resource.data) || request.resource.data.enabledAt is number || request.resource.data.enabledAt == null)
            && (!('watchThreshold' in request.resource.data) || (request.resource.data.watchThreshold is number && request.resource.data.watchThreshold >= 0.0 && request.resource.data.watchThreshold <= 1.0)))
          ||
          (settingId == 'notificationSwitches'
            && request.resource.data.keys().hasOnly(['platformUpdates', 'curriculumUpdates', 'laggingWarnings', 'updatedAt'])
            && request.resource.data.platformUpdates is bool
            && request.resource.data.curriculumUpdates is bool
            && request.resource.data.laggingWarnings is bool)
        );
      allow delete: if false;
    }"""

assert old_settings in content, "old_settings not found"
content = content.replace(old_settings, new_settings, 1)

with open('firestore.rules', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: firestore.rules updated cleanly!")
