beforeAll(async () => {

})

afterAll(async () => {

})

test("schema is okay", async () => {
    const sqlite = await (await import("sql.js")).default();
    const db = new sqlite.Database();
    const result = db.exec("SELECT 1;")
    expect(result).toBe(1);
})