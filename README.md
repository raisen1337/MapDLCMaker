# 🗺️ GTA V Map DLC Maker 🛠️

This Node.js script automates the creation of custom map DLC packages for Grand Theft Auto V. It simplifies the process of bundling your individual mapping projects into playable DLCs, handling the complex RPF packing and XML generation based on a tested structure.

## ✨ Features

*   **🚀 Automated Folder Detection:** Automatically scans the `inputmaps` directory for all your individual mapping project folders.
*   **🏷️ Flexible Naming:** Generates DLC names, RPF names, and XML identifiers directly from your input folder names, allowing for unique and descriptive DLCs.
*   **📦 Single RPF Bundling:** Consolidates all your mapping assets (`.ymap`, `.ymf`, `.ytyp`, `.ydr`, `.ytd`, `.ybn`) into a single RPF archive (`[your-map-name].rpf`) for each DLC.
*   **⚙️ Correct DLC Structure:** Creates a `dlc.rpf` for each map, containing `content.xml`, `setup2.xml`, and your packed map RPF within the `%PLATFORM%` folder, following a structure known to load correctly.
*   **🧹 Automatic Cleanup:** Removes all temporary files and folders generated during the process, leaving only the final DLC package.
*   **🌐 Cross-Platform:** Built with Node.js, making it compatible with macOS and Windows.
*   **🔧 `gtautil.exe` Included:** The necessary `gtautil.exe` tool is already provided in the `utils/` folder.

## ⚠️ Important Disclaimer

This tool is designed to assist in packaging your custom mapping assets for Grand Theft Auto V. **The responsibility for the content you package and its usage lies entirely with you.**

*   **Unlicensed/Leaked Assets:** Using unlicensed, leaked, or otherwise unauthorized assets is strictly prohibited by many platforms, including RageMP's Terms of Service. Such actions can lead to severe consequences, including permanent bans for your server and personal accounts.
*   **Copyright Infringement:** Ensure you have the necessary rights or permissions for all assets included in your mapping projects. Distributing copyrighted material without authorization is illegal.

**By using this script, you acknowledge and accept full responsibility for any legal or platform-specific repercussions that may arise from the content you choose to package and distribute.** The developers of this script are not liable for any misuse or consequences.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js:** Download and install from [nodejs.org](https://nodejs.org/). This script requires Node.js to run.

## 🚀 Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/raisen1337/MapDLCMaker.git
    cd MapDLCMaker
    ```

2.  **Verify `gtautil.exe`:**
    Ensure that `gtautil.exe` is present in the `utils/` folder within the cloned repository. It should already be there.

3.  **Create `inputmaps` Directory:**
    In the root of the `MapDLCMaker` directory (where `mapping.js` is located), create a new folder named `inputmaps`.

    ```
    MapDLCMaker/
    ├── mapping.js
    ├── utils/
    │   └── gtautil.exe
    └── inputmaps/  <-- Create this folder
    ```

4.  **Organize Your Mapping Projects:**
    Place each of your individual mapping projects into separate subfolders inside the `inputmaps` directory. Each subfolder should contain all the `.ymap`, `.ymf`, `.ytyp`, `.ydr`, `.ytd`, `.ybn` files related to that specific map.

    ```
    MapDLCMaker/
    └── inputmaps/
        ├── My Awesome Map/
        │   ├── my_awesome_map.ymap
        │   ├── my_awesome_map_lod.ymap
        │   ├── my_awesome_map.ytyp
        │   └── custom_texture.ytd
        ├── Another-Map-V2/
        │   ├── another_map.ymap
        │   └── prop_model.ydr
        └── Some_Other_Location/
            └── ... (more map files)
    ```

## 🎮 Usage

1.  **Open your Terminal/Command Prompt:**
    Navigate to the `MapDLCMaker` directory:
    ```bash
    cd E:\vehutils\MapDLCMaker # Or wherever you cloned the repo
    ```

2.  **Run the Script:**
    ```bash
    node mapping.js
    ```

3.  **Monitor the Output:**
    The script will scan the `inputmaps` directory, process each subfolder, and output progress messages to the console. It will log warnings if any input directories are not found or are inaccessible, skipping them gracefully.

4.  **Find Your DLCs:**
    Once the script completes, your generated DLC packages will be located in the `output/` directory, with each map having its own uniquely named folder (e.g., `output/dlc_my_awesome_map/`).

## 📦 Output Structure

For each mapping folder you place in `inputmaps/`, the script will create a new folder in `output/` with a name like `dlc_[your-map-name-sanitized]`. Inside this folder, you will find your final `dlc.rpf` with the following internal structure:

```
output/
└── dlc_my_awesome_map/
└── dlc.rpf
├── content.xml
├── setup2.xml
└── %PLATFORM%/
└── my_awesome_map.rpf
├── my_awesome_map.ymap
├── my_awesome_map_lod.ymap
├── my_awesome_map.ytyp
└── custom_texture.ytd
└── prop_model.ydr
└── ... (all other mapping files directly at the root of this RPF)
```


## 🔗 Repository

You can find the latest version of this script and contribute on GitHub:
[https://github.com/raisen1337/MapDLCMaker](https://github.com/raisen1337/MapDLCMaker)
