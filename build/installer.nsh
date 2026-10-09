; Registers Auralis as a browser the user can choose in Settings > Apps >
; Default apps. Windows never lets an app make itself the default; the user
; picks it there (Auralis opens that page from its own Settings).

!macro customInstall
  WriteRegStr HKCU "Software\Classes\AuralisURL" "" "Auralis URL"
  WriteRegStr HKCU "Software\Classes\AuralisURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\AuralisURL\DefaultIcon" "" "$INSTDIR\Auralis.exe,0"
  WriteRegStr HKCU "Software\Classes\AuralisURL\shell\open\command" "" '"$INSTDIR\Auralis.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\AuralisHTML" "" "Auralis HTML Document"
  WriteRegStr HKCU "Software\Classes\AuralisHTML\DefaultIcon" "" "$INSTDIR\Auralis.exe,0"
  WriteRegStr HKCU "Software\Classes\AuralisHTML\shell\open\command" "" '"$INSTDIR\Auralis.exe" "%1"'

  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis" "" "Auralis"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\DefaultIcon" "" "$INSTDIR\Auralis.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\shell\open\command" "" '"$INSTDIR\Auralis.exe"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities" "ApplicationName" "Auralis"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities" "ApplicationIcon" "$INSTDIR\Auralis.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities" "ApplicationDescription" "A web browser in the Aero tradition."
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities\URLAssociations" "http" "AuralisURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities\URLAssociations" "https" "AuralisURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities\FileAssociations" ".htm" "AuralisHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities\FileAssociations" ".html" "AuralisHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Auralis\Capabilities\FileAssociations" ".xhtml" "AuralisHTML"
  WriteRegStr HKCU "Software\RegisteredApplications" "Auralis" "Software\Clients\StartMenuInternet\Auralis\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\AuralisURL"
  DeleteRegKey HKCU "Software\Classes\AuralisHTML"
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Auralis"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Auralis"
!macroend
