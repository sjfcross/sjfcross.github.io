// let die1 = Math.floor(Math.random()*6)+1;

function singSong() {
  console.log("DO");
  console.log("RE");
  console.log("MI");
}

// singSong()
// singSong()
// singSong()
// singSong()
// singSong()
// singSong()
// singSong()
// singSong()

// function greet() {
//   console.log("Hi!")
// }

// function greet(person) {
//   console.log(`Hi, ${person}!`);
// }

//   function greet(firstName) {
//  console.log(`firstName is ${firstName}`);
//   }

// function greet(firstName) {
//   console.log(`Hey there, ${firstName}!`)
// }




// Rant Exercise

function rant(message) {
  console.log(`${message}`.toUpperCase());
  console.log(`${message}`.toUpperCase());
  console.log(`${message}`.toUpperCase());
}



// INclude multiple Arguments

function greet(firstName, lastName) {
  console.log(`Hey there, ${firstName} ${lastName[0]}.`);
}



// repeat string num times

function repeat(str, numTimes) {
  let result = "";
  for (let i = 0; i < numTimes; i++) {
    result += str;
  }
  console.log(result);
}


// Define isSnakeEyes below:

function isSnakeEyes(die1, die2) {
  if (die1 === 1 && die2 === 1) {
      console.log('Snake Eyes!');
  } else {
     console.log('Not Snake Eyes!');
  }
}


// Return Keyword

function add(x, y) {
  if (typeof x !== 'number' ||  typeof y !== 'number') {
    return false;
  }
  return x + y;
}


//Multiply and Return Exercise

function multiply(x, y) {
  return x*y
}

//isSHortsWeather Exercise F = Temp 

function isShortsWeather(F) {
  if (F >= 75) {
    return true;
  }
  return false;
}


//Last Element Exercise


function lastElement(arr) {
  if(arr.length === 0) {
      return null;
  } else {
      return arr[arr.length - 1];
  }
}

// Alternative Solution
// const lastElement = arr => arr.length ? arr[arr.length - 1] : null;


//Capitalize Exercise

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// Alternative Solution
// const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);


//SumArray Exercise

function sumArray(numarr) {
  let sum = 0;
  for (let i =0; i < numarr.length; i++) {
    sum += numarr[i];
  }
    return sum
}

//Days of the week Exercise


const days = {
  1: 'Monday',
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday"
}

const returnDay = (number) => {
  if(number < 1 || number > 7) {
      return null;
  }
  return (days[number])
}

// Alternative Solution
// const returnDay = (num) => {
//   const days = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
//     if(num < 1 || num > 7) {
//         return days[0];
//     }
//     return (days[num]);
// }