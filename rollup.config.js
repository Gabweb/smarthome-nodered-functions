const files = ["auto-lights.js", "light-transitions.js", "energy-management.js", "ems-avail-energy.js"];

export default files.map(fileName => (
    // browser-friendly UMD build
    {
        input: 'dist/lib/' + fileName,
        output: {
            file: "dist/" + fileName,
            format: 'es'
        },
        treeshake: false,
    }
));