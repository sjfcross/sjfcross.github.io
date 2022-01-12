// Logical Operators

// const password = prompt("Input Password please.");
// if (password.length >= 6 && password.indexOf(" ") === -1) {
//     console.log("Good password")
// } else {
//     console.log("Password either to short or has spaces")
// }

const mystery = "P7ooooo"; //CHANGE THIS VALUE TO MAKE THE CONDITIONAL BELOW TRUE

// LEAVE THIS CODE ALONE! (pretty please)
if (mystery[0] === "P" && mystery.length > 5 && mystery.indexOf("7") !== -1) {
  console.log("YOU GOT IT!!!");
}

// 0-5 - FREE
// 5-10 CHILD $10
// 10 - 65 ADULT $20
// 65+ SENIOR Free

// const age = 10;
// if ((age >= 0 && age < 5) || age >= 65)  {
//     console.log("Free")
// } else if(age >= 5 && age < 10) {
//     console.log("$10")
// } else if(age >= 10 && age < 65) {
//     console.log("$20")
// } else {
//     console.log("Invalid age !")
// }

// let firstName = prompt("Please enter your first name")
// if(!firstName) {
//     firstName = prompt("Try again !!!");
// }

// const age = 4;
// if (!(age >= 0 && age < 5 || age >= 65)) {
//     console.log("You are not Baby nor Senior !")
// }

const day = 8;
switch (day) {
  case 1:
    console.log("Monday");
    break;
  case 2:
    console.log("Tuesday");
    break;
  case 3:
    console.log("Wednesday");
    break;
  case 4:
    console.log("Thursday");
    break;
  case 5:
    console.log("Friday");
    break;
  case 6:
  case 7:
    console.log("Weekend!");
    break;
    default:
      console.log("I don't know that !")
}


const leaderboard = ['Harry', 'Lua', 'Hermione', 'Bellatrix'];

// -----------------------------------

const product = {
  name:"Gummy Bears",
  inStock: true,
  price: 1.99,
  flavors: ["grape","apple","cherry"]
}
// -------------------------------------------
// Getting data outta Objects
//PLEASE DON'T TOUCH THIS LINE!
const restaurant = {
  name: 'Ichiran Ramen',
  address: `${Math.floor(Math.random() * 100) + 1} Johnson Ave`,
  city: 'Brooklyn',
  state: 'NY',
  zipcode: '11206',
}

//YOUR CODE GOES DOWN HERE:
let fullAddress = restaurant["address"]+", "+restaurant["city"]+", "+restaurant["state"]+" "+restaurant["zipcode"]

// Result :

//  fullAddress
//     '20 Johnson Ave, Brooklyn, NY 11206'
