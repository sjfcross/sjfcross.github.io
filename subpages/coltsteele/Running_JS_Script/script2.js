// Logical Operators





const password = prompt("Input Password please.");
if (password.length >= 6 && password.indexOf(" ") === -1) {
    console.log("Good password")
} else {
    console.log("Password either to short or has spaces")
} 


const mystery = 'P7ooooo'; //CHANGE THIS VALUE TO MAKE THE CONDITIONAL BELOW TRUE



// LEAVE THIS CODE ALONE! (pretty please)
if(mystery[0] === 'P' && mystery.length > 5 && mystery.indexOf('7') !== -1){
    console.log("YOU GOT IT!!!");
}

