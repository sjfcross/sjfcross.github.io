// ===================================
// NESTED FOR LOOP EXAMPLES
// ===================================

for (let i = 1; i <= 10; i++) {
    console.log(`i is: ${i}`)
    for (let j = 1; j < 4; j++) {
        console.log(`     j is: ${j}`)
    }
}

// let s = "";
// for(let i = 1; i < 11; i += 1) {
//   s += i + " ";
// }
// console.log(s);

// ===================================
// NESTED ARRAY ITERATION
// ===================================


const seatingChart = [
    ['Kristen', 'Erik', 'Namita'],
    ['Geoffrey', 'Juanita', 'Antonio', 'Kevin'],
    ['Yuma', 'Sakura', 'Jack', 'Erika']
]

for (let i = 0; i < seatingChart.length; i++) {
    const row = seatingChart[i];
    console.log(`ROW #${i + 1}`)
    for (let j = 0; j < row.length; j++) {
        console.log(row[j])
    }
}

// 1 seatingchart[0]  erstes array inside
// row 0 (Kristen erik namita)
// seatingChart[1] ...

// seatingChart[2] ...

// row.length is now how many kids/row aka ( 3, 4, 4)


// i=0 means seatingChart[0] 
// means row  is (first line) ["Kristen","Erik","Namita"]
// (means log is ROW #1)

// now we run internal till false (row.length is under 3) 
// j = 0 gives us row[0]=Kristen
// j = 1 gives us row[1]=Erik
// j = 2 gives us row[2]=namita

// i=2 means seatingChart[2]
// means row is 3rd line ["Yuma","Sakura","Jack","Erika"]
// means log is ROW #3

// now we run internal till false (row.length is under 4) 
// j = 0 gives us row[0]=Yuma
// j = 1 gives us row[1]=Sakura
// j = 2 gives us row[2]=Jack
// j = 3 gives us row[3]=Erika
