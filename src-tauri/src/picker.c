#define INITGUID
#define COBJMACROS
#include <windows.h>
#include <shobjidl.h>
#include <stdlib.h>

wchar_t* pick_folder_native(void) {
    HRESULT hr_co = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
    int need_uninit = SUCCEEDED(hr_co);

    IFileOpenDialog *pFileOpen = NULL;
    HRESULT hr = CoCreateInstance(&CLSID_FileOpenDialog, NULL, CLSCTX_ALL, &IID_IFileOpenDialog, (void**)&pFileOpen);
    if (!SUCCEEDED(hr)) {
        if (need_uninit) CoUninitialize();
        return NULL;
    }

    FILEOPENDIALOGOPTIONS dwOptions = 0;
    if (SUCCEEDED(pFileOpen->lpVtbl->GetOptions(pFileOpen, &dwOptions))) {
        pFileOpen->lpVtbl->SetOptions(pFileOpen, dwOptions | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
    }
    pFileOpen->lpVtbl->SetTitle(pFileOpen, L"Выбор папки");

    hr = pFileOpen->lpVtbl->Show(pFileOpen, NULL);
    wchar_t* result_path = NULL;
    if (SUCCEEDED(hr)) {
        IShellItem *pItem = NULL;
        hr = pFileOpen->lpVtbl->GetResult(pFileOpen, &pItem);
        if (SUCCEEDED(hr)) {
            PWSTR pszFilePath = NULL;
            hr = pItem->lpVtbl->GetDisplayName(pItem, SIGDN_FILESYSPATH, &pszFilePath);
            if (SUCCEEDED(hr) && pszFilePath != NULL) {
                size_t len = wcslen(pszFilePath) + 1;
                result_path = (wchar_t*)malloc(len * sizeof(wchar_t));
                if (result_path) {
                    wcscpy(result_path, pszFilePath);
                }
                CoTaskMemFree(pszFilePath);
            }
            pItem->lpVtbl->Release(pItem);
        }
    }

    pFileOpen->lpVtbl->Release(pFileOpen);
    if (need_uninit) {
        CoUninitialize();
    }
    return result_path;
}

void free_folder_path(wchar_t* ptr) {
    if (ptr) {
        free(ptr);
    }
}
