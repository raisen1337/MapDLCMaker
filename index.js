const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Define output base directory and gtautil path
const OUTPUT_BASE_DIR = 'outputmaps'; // This will create folders like 'output/dlc_your_folder_name'
const GTAUTIL_PATH = path.join(__dirname, 'utils', 'gtautil'); // Assuming 'gtautil' is in a 'utils' folder sibling to the script

// Define the root directory where all mapping input folders are located
const INPUT_ROOT_DIR = 'inputmaps'; // This is relative to where the script is run, or an absolute path

// Define valid GTA 5 mapping file extensions (all will go into one RPF)
const ALL_MAPPING_EXTENSIONS = new Set(['.ymap', '.ymf', '.ytyp', '.ydr', '.ytd', '.ybn']);

// XML Templates for the MAPPING DLC (new structure - now precisely matching your examples)
const CONTENT_XML_MAPPING_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<CDataFileMgr__ContentsOfDataFileXml>
	<disabledFiles />
	<includedXmlFiles />
	<includedDataFiles />
	<dataFiles>
		<Item>
			<filename>DLC_NAME_LOWER:/%PLATFORM%/MAPPING_BASE_NAME_LOWER.rpf</filename>
			<fileType>RPF_FILE</fileType>
			<locked value="true"/>
			<disabled value="true"/>
			<persistent value="true"/>
			<overlay value="true"/>
		</Item>
	</dataFiles>
	<contentChangeSets>
		<Item>
			<changeSetName>MAPPING_BASE_NAME_UPPER_STARTUP</changeSetName>
			<filesToEnable>
				<!-- NULL -->
      </filesToEnable>
		</Item>
		<Item>
      <changeSetName>MAPPING_BASE_NAME_UPPER_STREAMING</changeSetName>
      <filesToEnable>
      	<!-- Mapping ymap archiv -->
				<Item>DLC_NAME_UPPER:/%PLATFORM%/MAPPING_BASE_NAME_LOWER.rpf</Item>
      </filesToEnable>
      <executionConditions>
        <activeChangesetConditions>
        </activeChangesetConditions>
        <genericConditions>$level=LEVEL_NAME_HASH</genericConditions>
      </executionConditions>
    </Item>
		<!-- next Part -->
		<Item>
      <changeSetName>MAPPING_BASE_NAME_UPPER_MAP</changeSetName>
      <mapChangeSetData>
        <Item>
          <associatedMap>LEVEL_NAME_HASH</associatedMap>
          <filesToInvalidate />
          <filesToEnable>
						<Item>DLC_NAME_UPPER:/%PLATFORM%/MAPPING_BASE_NAME_LOWER.rpf</Item>
          </filesToEnable>
        </Item>
      </mapChangeSetData>
      <requiresLoadingScreen value="false"/>
      <loadingScreenContext>LOADINGSCREEN_CONTEXT_LAST_FRAME</loadingScreenContext>
      <useCacheLoader value="false"/>
    </Item>
	</contentChangeSets>
	<patchFiles />
</CDataFileMgr__ContentsOfDataFileXml>`;

const SETUP2_XML_MAPPING_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<SSetupData>
	<deviceName>DLC_NAME_UPPER</deviceName>
	<datFile>content.xml</datFile>
	<timeStamp>TIMESTAMP_PLACEHOLDER</timeStamp>
	<nameHash>MAPPING_BASE_NAME_LOWER</nameHash>
	<contentChangeSets />
	<contentChangeSetGroups>
		<Item>
			<NameHash>GROUP_STARTUP</NameHash>
			<ContentChangeSets>
				<Item>MAPPING_BASE_NAME_UPPER_STARTUP</Item>
			</ContentChangeSets>
		</Item>
		<Item>
      <NameHash>GROUP_MAP</NameHash>
      <ContentChangeSets>
        <Item>MAPPING_BASE_NAME_UPPER_MAP</Item>
      </ContentChangeSets>
    </Item>
		<Item>
      <NameHash>GROUP_UPDATE_STREAMING</NameHash>
      <ContentChangeSets>
        <Item>MAPPING_BASE_NAME_UPPER_STREAMING</Item>
      </ContentChangeSets>
    </Item>
	</contentChangeSetGroups>
	<startupScript />
	<scriptCallstackSize value="0" />
	<type>EXTRACONTENT_COMPAT_PACK</type>
	<order value="25" />
	<minorOrder value="0" />
	<isLevelPack value="false" />
	<dependencyPackHash />
	<requiredVersion />
	<subPackCount value="0" />
</SSetupData>`;

/**
 * Ensures a directory exists. If not, it creates it recursively.
 * @param {string} dirPath The path to the directory.
 * @returns {Promise<void>}
 */
async function ensureDirExists(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Copies a file to a target directory.
 * It handles potential file existence by skipping if already present.
 * @param {string} sourcePath The full path of the file to copy.
 * @param {string} destinationDir The directory where the file should be copied.
 * @returns {Promise<void>}
 */
async function copyFileToOutput(sourcePath, destinationDir) {
    const fileName = path.basename(sourcePath);
    const destinationPath = path.join(destinationDir, fileName);
    try {
        await fs.copyFile(sourcePath, destinationPath);
    } catch (error) {
        if (error.code !== 'EEXIST') { // Ignore 'file already exists' errors
            console.error(`Error copying file ${sourcePath} to ${destinationDir}:`, error);
        }
    }
}

/**
 * Recursively searches for files matching allowed extensions
 * within a specified directory and its subdirectories.
 * @param {string} directory The starting directory for the search.
 * @param {Set<string>} allowedExtensions A set of allowed file extensions.
 * @returns {Promise<string[]>} A promise that resolves to an array of full file paths.
 */
async function findMappingFiles(directory, allowedExtensions) {
    let results = new Set();
    async function traverse(currentDir) {
        try {
            const items = await fs.readdir(currentDir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(currentDir, item.name);
                if (item.isDirectory()) {
                    await traverse(fullPath); // Recursive call
                } else if (item.isFile()) {
                    const fileExtension = path.extname(item.name).toLowerCase();
                    if (allowedExtensions.has(fileExtension)) {
                        results.add(fullPath);
                    }
                }
            }
        } catch (error) {
            // Log specific errors that might prevent file listing, but don't stop execution
            if (error.code === 'ENOENT') {
                console.error(`  Warning: Sub-directory not found or inaccessible during scan: '${currentDir}'`);
            } else if (error.code === 'EACCES') {
                console.error(`  Warning: Permission denied to access sub-directory during scan: '${currentDir}'`);
            } else {
                console.error(`  Error traversing sub-directory during scan '${currentDir}':`, error);
            }
        }
    }
    await traverse(directory);
    return Array.from(results);
}

/**
 * Generates content.xml for the mapping DLC.
 * @param {string} dlcNameLower The internal unique DLC name (lowercase base name).
 * @param {string} dlcNameUpper The internal unique DLC name (uppercase base name).
 * @param {string} mappingBaseNameLower The base name for the mapping (lowercase).
 * @param {string} mappingBaseNameUpper The base name for the mapping (uppercase).
 * @param {string} levelNameHash The hash for the level name (e.g., MO_JIM_L11).
 * @returns {string} The generated XML content.
 */
function generateMappingContentXml(dlcNameLower, dlcNameUpper, mappingBaseNameLower, mappingBaseNameUpper, levelNameHash) {
    let content = CONTENT_XML_MAPPING_TEMPLATE;
    content = content.replace(/DLC_NAME_LOWER/g, dlcNameLower);
    content = content.replace(/DLC_NAME_UPPER/g, dlcNameUpper);
    content = content.replace(/MAPPING_BASE_NAME_LOWER/g, mappingBaseNameLower);
    content = content.replace(/MAPPING_BASE_NAME_UPPER/g, mappingBaseNameUpper);
    content = content.replace(/LEVEL_NAME_HASH/g, levelNameHash);
    return content;
}

/**
 * Generates setup2.xml for the mapping DLC.
 * @param {string} dlcNameUpper The internal unique DLC name (uppercase base name).
 * @param {string} mappingBaseNameLower The base name for the mapping (lowercase).
 * @param {string} mappingBaseNameUpper The base name for the mapping (uppercase).
 * @returns {string} The generated XML content.
 */
function generateMappingSetup2Xml(dlcNameUpper, mappingBaseNameLower, mappingBaseNameUpper) {
    const timestamp = new Date().toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
    });

    let content = SETUP2_XML_MAPPING_TEMPLATE;
    content = content.replace(/DLC_NAME_UPPER/g, dlcNameUpper);
    content = content.replace(/MAPPING_BASE_NAME_LOWER/g, mappingBaseNameLower);
    content = content.replace(/MAPPING_BASE_NAME_UPPER/g, mappingBaseNameUpper);
    content = content.replace(/TIMESTAMP_PLACEHOLDER/g, timestamp);
    return content;
}

/**
 * Sanitizes a string to be used as a valid identifier (lowercase, alphanumeric, no hyphens).
 * Converts to lowercase and removes non-alphanumeric characters.
 * @param {string} name The string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitizeIdentifier(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Converts a string to uppercase, removing non-alphanumeric characters.
 * @param {string} name The string to convert.
 * @returns {string} The converted string.
 */
function toUpperSnakeCase(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Main function to orchestrate the scanning, file organization, and RPF creation process for mappings.
 */
async function main() {
    // Ensure the base output directory exists
    await ensureDirExists(OUTPUT_BASE_DIR);

    let inputMappingFolders = [];
    try {
        const items = await fs.readdir(INPUT_ROOT_DIR, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                inputMappingFolders.push(path.join(INPUT_ROOT_DIR, item.name));
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: The inputmaps directory ('${INPUT_ROOT_DIR}') was not found. Please create it and place your mapping folders inside.`);
        } else if (error.code === 'EACCES') {
            console.error(`Error: Permission denied to access the inputmaps directory ('${INPUT_ROOT_DIR}').`);
        } else {
            console.error(`Error reading inputmaps directory '${INPUT_ROOT_DIR}':`, error);
        }
        return; // Exit if inputmaps directory cannot be read
    }

    if (inputMappingFolders.length === 0) {
        console.warn(`No subfolders found in '${INPUT_ROOT_DIR}'. Please place your mapping folders inside 'inputmaps'.`);
        return;
    }

    for (const currentMappingInputPath of inputMappingFolders) {
        // Check if the current mapping input path actually exists and is a directory
        let stats;
        try {
            stats = await fs.stat(currentMappingInputPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`\n--- Skipping mapping for "${path.basename(currentMappingInputPath)}" ---`);
                console.warn(`  Input directory not found: '${currentMappingInputPath}'.`);
            } else if (error.code === 'EACCES') {
                console.warn(`\n--- Skipping mapping for "${path.basename(currentMappingInputPath)}" ---`);
                console.warn(`  Permission denied to access input directory: '${currentMappingInputPath}'.`);
            } else {
                console.error(`\n--- Error checking input directory "${path.basename(currentMappingInputPath)}" ---`);
                console.error(`  Error:`, error);
            }
            continue; // Skip to the next mapping in the list
        }

        if (!stats.isDirectory()) {
            console.warn(`\n--- Skipping mapping for "${path.basename(currentMappingInputPath)}" ---`);
            console.warn(`  Path is not a directory: '${currentMappingInputPath}'.`);
            continue; // Skip if it's not a directory
        }

        // Derive names from the folder name, allowing flexibility
        const folderName = path.basename(currentMappingInputPath);
        const mappingBaseNameLower = sanitizeIdentifier(folderName); // e.g., myawesomemap
        const mappingBaseNameUpper = toUpperSnakeCase(folderName); // e.g., MYAWESOMEMAP

        const dlcNameLower = `dlc_${mappingBaseNameLower}`; // e.g., dlc_myawesomemap
        const dlcNameUpper = `dlc_${mappingBaseNameUpper}`; // e.g., dlc_MYAWESOMEMAP (used in content.xml filesToEnable)

        const levelNameHash = `${mappingBaseNameUpper}_L11`; // e.g., MYAWESOMEMAP_L11 (or use MO_JIM_L11 if it's a fixed value)
        // For now, let's stick to MO_JIM_L11 as per the example for genericConditions and associatedMap
        // If the user wants this to be dynamic based on folder name, they'll need to specify.
        const fixedLevelNameHash = 'MO_JIM_L11';


        console.log(`\n--- Starting mapping DLC creation for: "${folderName}" (DLC: ${dlcNameLower}, Base Name: ${mappingBaseNameLower}) ---`);

        const dlcOutputRoot = path.join(OUTPUT_BASE_DIR, dlcNameLower);
        await ensureDirExists(dlcOutputRoot);

        // --- Temporary input folder for the single MAPPING_BASE_NAME.rpf ---
        const tempMappingRpfInput = path.join(dlcOutputRoot, `temp_${mappingBaseNameLower}_rpf_input`);
        await ensureDirExists(tempMappingRpfInput);

        // Find all mapping files in the current input directory
        console.log(`Scanning input directory '${currentMappingInputPath}' for mapping files...`);
        const allMappingFiles = await findMappingFiles(currentMappingInputPath, ALL_MAPPING_EXTENSIONS);

        if (allMappingFiles.length === 0) {
            console.warn(`No mapping files (${Array.from(ALL_MAPPING_EXTENSIONS).join(', ')}) found in '${currentMappingInputPath}'. Skipping this mapping.`);
            // Clean up any directories created for this specific mapping before continuing to the next
            try {
                await fs.rm(dlcOutputRoot, { recursive: true, force: true });
            } catch (error) {
                console.error(`Error cleaning up empty mapping output folder ${dlcOutputRoot}:`, error);
            }
            continue; // Skip to the next mapping in the list
        }

        // Copy all found mapping files directly into the temporary RPF input folder
        let copiedFilesCount = 0;
        for (const file of allMappingFiles) {
            await copyFileToOutput(file, tempMappingRpfInput);
            copiedFilesCount++;
        }
        console.log(`  Copied ${copiedFilesCount} mapping files to ${tempMappingRpfInput}`);

        // --- Create the single MAPPING_BASE_NAME.rpf ---
        const mappingRpfName = `${mappingBaseNameLower}.rpf`;
        const mappingRpfPath = path.join(dlcOutputRoot, mappingRpfName);
        const gtautilMappingCommand = `${GTAUTIL_PATH} createarchive --input "${tempMappingRpfInput}" --output "${dlcOutputRoot}" --name ${mappingBaseNameLower}`;
        console.log(`  Executing: ${gtautilMappingCommand}`);
        try {
            const { stdout, stderr } = await execPromise(gtautilMappingCommand);
            if (stdout) console.log(`  gtautil stdout: ${stdout}`);
            if (stderr) console.error(`  gtautil stderr: ${stderr}`);
            console.log(`  Successfully created ${mappingRpfPath}.`);
        } catch (error) {
            console.error(`  Error creating ${mappingRpfPath}:`, error);
        }

        // Clean up temporary input folder for the intermediate RPF
        try {
            await fs.rm(tempMappingRpfInput, { recursive: true, force: true });
            console.log(`  Cleaned up temporary folder: ${tempMappingRpfInput}`);
        } catch (error) {
            console.error(`  Error cleaning up temporary RPF input folder ${tempMappingRpfInput}:`, error);
        }

        // --- Prepare the final dlc.rpf ---
        const finalDlcTempInput = path.join(dlcOutputRoot, `temp_final_dlc_input`);
        const finalDlcPlatformDir = path.join(finalDlcTempInput, 'x64'); // Create %PLATFORM% directory
        await ensureDirExists(finalDlcPlatformDir);

        // Move the created MAPPING_BASE_NAME.rpf into the %PLATFORM% directory within the final DLC structure
        const sourceRpfPath = path.join(dlcOutputRoot, mappingRpfName);
        const destinationRpfPath = path.join(finalDlcPlatformDir, mappingRpfName);
        try {
            await fs.rename(sourceRpfPath, destinationRpfPath);
            console.log(`  Moved ${mappingRpfName} to ${path.join('x64', mappingRpfName)}`);
        } catch (error) {
            console.error(`  Error moving ${mappingRpfName}:`, error);
        }

        // Generate and Save content.xml and setup2.xml for the final DLC
        const finalContentXml = generateMappingContentXml(dlcNameLower, dlcNameUpper, mappingBaseNameLower, mappingBaseNameUpper, fixedLevelNameHash);
        await fs.writeFile(path.join(finalDlcTempInput, 'content.xml'), finalContentXml);
        console.log(`  Generated final content.xml for ${dlcNameLower}`);

        const finalSetup2Xml = generateMappingSetup2Xml(dlcNameUpper, mappingBaseNameLower, mappingBaseNameUpper);
        await fs.writeFile(path.join(finalDlcTempInput, 'setup2.xml'), finalSetup2Xml);
        console.log(`  Generated final setup2.xml for ${dlcNameLower}`);

        // Execute gtautil to create the final dlc.rpf
        const finalDlcRpfPath = path.join(dlcOutputRoot, 'dlc.rpf');
        const gtautilFinalDlcCommand = `${GTAUTIL_PATH} createarchive --input "${finalDlcTempInput}" --output "${dlcOutputRoot}" --name dlc`;
        console.log(`  Executing: ${gtautilFinalDlcCommand}`);
        try {
            const { stdout, stderr } = await execPromise(gtautilFinalDlcCommand);
            if (stdout) console.log(`  gtautil stdout: ${stdout}`);
            if (stderr) console.error(`  gtautil stderr: ${stderr}`);
            console.log(`  Successfully created final ${finalDlcRpfPath}.`);
        } catch (error) {
            console.error(`  Error creating final ${finalDlcRpfPath}:`, error);
        }

        // Clean up temporary final DLC input folder
        try {
            await fs.rm(finalDlcTempInput, { recursive: true, force: true });
            console.log(`  Cleaned up temporary final DLC input folder: ${finalDlcTempInput}`);
        } catch (error) {
            console.error(`  Error cleaning up temporary final DLC input folder ${finalDlcTempInput}:`, error);
        }

        console.log(`\nMapping RPF package for "${folderName}" created and organized. Check the "output/${dlcNameLower}" folder.`);
    }

    console.log('\nAll requested mapping RPF packages have been processed.');
}

// Execute the main function
main().catch(console.error);
