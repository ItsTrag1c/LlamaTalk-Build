!macro NSIS_HOOK_PREINSTALL
  ; Clean previous installation files (preserves %APPDATA% config/memory)
  RMDir /r "$INSTDIR"
!macroend
