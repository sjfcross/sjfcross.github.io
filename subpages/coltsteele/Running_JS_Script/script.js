console.log("Hello from our first JS - File, Mofo !");
let total = 1 + 4;
console.log("Goodby !! !");

console.log("Next Conditionals");

console.log("Before Conditional");
if (1 + 1 === 2) {
  console.log("Math still works!");
}
console.log("After Conditionals");

let random = Math.random();
if (random < 0.5) {
  console.log("Your number is less then 0.5!!!");
} else {
  console.log("Your number is greater (or equal) then 0.5!!!!");
}
console.log(random);

// if (random >= 0.5) {
//   console.log("Your number is BIGGER then 0.5!!!");
//   console.log(random);
// }

// const dayOfWeek = prompt("Enter a day").toLowerCase();

// if (dayOfWeek === "monday") {
//   console.log("Uhggg I hate Mondays");
// } else if (dayOfWeek === "saturday") {
//   console.log("Yeeeah I love Saturdays");
// } else if (dayOfWeek === "friday") {
//   console.log("Cool, Friday is alright!");
// } else {
//     console.log("Meh")
// }

//  else if (dayOfWeek === "Tuesday") {
//   console.log("Meh");
// } else if (dayOfWeek === "Wednesday") {
//   console.log("Meh");
// } else if (dayOfWeek === "Thursday") {
//   console.log("Meh");
// } else if (dayOfWeek === "Sunday") {
//   console.log("Meh");
// }

// 0-5 - FREE
// 5-10 CHILD $10
// 10 - 65 ADULT $20
// 65+ SENIOR $10

// const age = 65;
// if (age < 5) {
//   console.log("You are a baby. You get in for free !");
// } else if (age < 10) {
//   console.log("You are between 5y and 10y old. Pay $10 !");
// } else if (age < 65) {
//   console.log("You are an adult. Pay up all the $20!");
// } else if (age >= 65) {
//   console.log("You are a senior. $10 is enough for u!");
// }

// const password = prompt("Please enter password");

//Password must be 6+ Characters

// if(password.length >= 6) {
//   console.log("Long enough password.")
// } else {
//   console.log("Password too short, 6+ Characters required!")
// }
// //Password  cannot include space

// if (password.indexOf(' ') === -1) {
//   console.log("Great, password has no space !")
// } else {
//   console.log("Password cannot contain spaces.")
// }

//Password must be 6+ Characters
//Password  cannot include space

// if (password.length >= 6) {
//   if (password.indexOf(" ") === -1) {
//     console.log("Valid Password");
//   } else {
//     console.log("Password cannot contain spaces !");
//   }
// } else {
//   console.log("Password too short, 6+ Characters required!");
// }

// Change the value of num, so that "YOU GOT ME!" prints out
const num = prompt("Please enter a number!"); // THIS IS THE ONLY LINE YOU SHOULD CHANGE :)

// DO NOT TOUCH ANYTHING BELOW (please)
if (num <= 100) {
  if (num >= 50) {
    console.log("U think under 100 makes sense ?");
  } else {
    console.log("At least try over 50, maybe ?");
  }
} else {
  if (num < 103) {
    if (num % 2 === 0) {
      console.log("YOU GOT ME!");
    } else {
      console.log("Not far, but still wrong :D");
    }
  } else {
    console.log("Way above 100 u sucker !");
  }
}
