
const sheetService = require('../backend/googleSheetService');

async function testDriveImage() {
    const fileId = '1Iyp0jf3V8a5Mf3-PjS0YsjXrWnf601yN';
    console.log(`--- Starting Drive Image Extraction Test for ID: ${fileId} ---`);

    try {
        console.log('1. Connecting to Google Services...');
        await sheetService.connect();
        console.log('   Service Account:', sheetService.clientEmail);

        console.log('\n2. Fetching File Metadata...');
        const metadata = await sheetService.drive.files.get({
            fileId: fileId,
            fields: 'name, mimeType, size',
            auth: sheetService.authClient
        });
        console.log('   Metadata found:');
        console.log(`   - Name: ${metadata.data.name}`);
        console.log(`   - MimeType: ${metadata.data.mimeType}`);
        console.log(`   - Size: ${metadata.data.size} bytes`);

        console.log('\n3. Attempting to Stream File...');
        const result = await sheetService.getDriveFileStream(fileId);
        console.log(`   Stream opened successfully.`);
        console.log(`   Content-Type: ${result.contentType}`);

        // We won't download the whole file, just check if the stream starts
        return new Promise((resolve, reject) => {
            let chunkCount = 0;
            result.stream.on('data', (chunk) => {
                chunkCount++;
                if (chunkCount === 1) {
                    console.log(`   Received first chunk of data (${chunk.length} bytes).`);
                    console.log('\n--- Test Passed Successfully ---');
                    resolve();
                }
            });
            result.stream.on('error', (err) => {
                console.error('   Error during streaming:', err);
                reject(err);
            });
            // Timeout if no data received
            setTimeout(() => {
                if (chunkCount === 0) {
                    reject(new Error('Timed out waiting for data from stream'));
                }
            }, 5000);
        });

    } catch (error) {
        console.error('\n!!! Test Failed !!!');
        if (error.response && error.response.data) {
            console.error('API Error details:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

testDriveImage();
