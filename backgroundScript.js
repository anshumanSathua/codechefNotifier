// Storage Initialisation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ submissions: [] });
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    try {
      const url = new URL(details.url);
      const solutionId = url.searchParams.get("solution_id");

      const data = await chrome.storage.sync.get(["submissions"]);
      const submissions = data.submissions;

      // Check if solution_id is present or not
      if (solutionId && !isPresent(solutionId, submissions)) {
        let submission = {
          title: getTitle(details.requestHeaders),
          solution_id: solutionId,
        };

        // Inserting solution_id
        submissions.push(submission);
        chrome.storage.sync.set({ submissions: submissions });

        fetchResults();
      }
    } catch (err) {
      console.error(err);
    }
  },
  { urls: ["*://www.codechef.com/*"] },
  ["requestHeaders", "extraHeaders"]
);

// Checking if submission already present into storage
const isPresent = (solution_id, submissions) => {
  let res = false;
  submissions.forEach((submission) => {
    if (submission.solution_id == solution_id) res = ture;
  });
  return res;
};

// Extracting title of the problem
const getTitle = (headers) => {
  let url = null;
  headers.forEach((header) => {
    if (header.name === "Referer") url = header.value;
  });
  return url.substring(url.lastIndexOf("/") + 1);
};

// Fetching results
const fetchResults = async () => {
  try {
    const data = await chrome.storage.sync.get(["submissions"]);
    const submissions = data.submissions;

    if (submissions.length) {
      const res = [];

      submissions.forEach((submission) => {
        res.push(
          getData(
            `https://www.codechef.com/api/ide/submit?solution_id=${submission.solution_id}`
          )
        );
      });

      Promise.all(res).then((res) => {
        res.forEach((r) => {
          if (r.result_code != "wait") {
            chrome.notifications.create("", {
              type: "basic",
              title: createTitle(r.upid, submissions),
              message: createMessage(r.result_code),
              iconUrl: "/icon.png",
            });
            chrome.storage.sync.set({
              submissions: updatedSubmissions(r.upid, submissions),
            });
          }
        });
        if (submissions.length) {
          setTimeout(fetchResults, 1000);
        }
      });
    }
  } catch (err) {
    console.error(err);
  }
};

// Fething individual response from api
const getData = async (url) => {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (err) {
    console.log(err);
  }
};

// Updating submissions array
const updatedSubmissions = (solution_id, submissions) => {
  let i = submissions.length;
  while (i--) {
    if (submissions[i]["solution_id"] === solution_id) {
      submissions.splice(i, 1);
    }
  }
  return submissions;
};

// Creating title for the message
const createTitle = (solution_id, submissions) => {
  let title = solution_id;
  submissions.forEach((solution) => {
    if (solution.solution_id === solution_id) {
      title = `Problem: ${solution.title}`;
    }
  });
  return title;
};

// Defining verdict for the message
const createMessage = (verdict) => {
  switch (verdict) {
    case "accepted":
      return "Solution Accepted!";
    case "partial_accepted":
      return "Solution Partially Accepted!";
    case "wrong":
      return "Wrong!";
    case "time":
      return "Time Limit Exceeded!";
    case "runtime":
      return "Run Time Error!";
    case "compile":
      return "Compile Time Error!";
    case "score":
      return "Insufficient Score!";
    case "error":
      return "Internal Error!";
  }
};
