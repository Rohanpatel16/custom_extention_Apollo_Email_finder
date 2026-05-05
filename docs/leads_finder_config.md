# Lead Fetching Parameters Reference

This document outlines the available parameters for fetching leads, including their types, default values, and valid options.

## Table of Contents
- [General Settings](#general-settings)
- [Contact Filters](#contact-filters)
- [Location Filters](#location-filters)
- [Company Filters](#company-filters)
- [Revenue & Funding](#revenue--funding)

---

## General Settings

### #️⃣ Number of leads to fetch (`fetch_count`)
- **Usage**: Optional
- **Type**: `integer`
- **Default**: `100000`
- **Description**: Leave this field empty if you want to scrape all leads for your search criteria.

### 📁 File name / Run label (`file_name`)
- **Usage**: Optional
- **Type**: `string`
- **Default**: `Prospects`
- **Description**: Give this run a custom file name or label for easy recognition in the run history.

---

## Contact Filters

### Include Job Titles (`contact_job_title`)
- **Usage**: Optional
- **Type**: `array`
- **Description**: Include these job titles. E.g., realtor, software developer, teacher etc.

### Exclude Job Titles (`contact_not_job_title`)
- **Usage**: Optional
- **Type**: `array`
- **Description**: Exclude these job titles. E.g., realtor, software developer, teacher etc.

### Seniority Level (`seniority_level`)
- **Usage**: Optional
- **Type**: `string[]`
- **Options**:
  - `founder`, `owner`, `c_suite`, `director`, `partner`, `vp`, `head`, `manager`, `senior`, `entry`, `trainee`

### Functional Level (`functional_level`)
- **Usage**: Optional
- **Type**: `string[]`
- **Options**:
  - `c_suite`, `finance`, `product_management`, `engineering`, `design`, `education`, `human_resources`, `information_technology`, `legal`, `marketing`, `operations`, `sales`, `support`

### Email Status (`email_status`)
- **Usage**: Optional
- **Type**: `string[]`
- **Options**:
  - `validated`, `not_validated`, `unknown`

---

## Location Filters

### Location (Region/Country/State) (`contact_location`)
- **Usage**: Optional
- **Type**: `string[]`
- **Description**: Select one or more locations to filter the leads.
- **Top Options**: `united states`, `germany`, `india`, `united kingdom`, `russia`, `france`, `china`, `canada`, `netherlands`, `mexico`, `belgium`, `japan`, `brazil`, `australia`, `poland`, etc.

### Exclude Location (`contact_not_location`)
- **Usage**: Optional
- **Type**: `string[]`
- **Description**: Select one or more locations to exclude.

### City (`contact_city`)
- **Usage**: Optional
- **Type**: `array`
- **Description**: Add one or more cities to filter the leads.

### Exclude City (`contact_not_city`)
- **Usage**: Optional
- **Type**: `array`

---

## Company Filters

### Company Website/Domain (`company_domain`)
- **Usage**: Optional
- **Type**: `array`
- **Description**: Include Company Website/Domain (e.g., google.com, apple.com).

### Company Size (`size`)
- **Usage**: Optional
- **Type**: `string[]`
- **Options**:
  - `1-10`, `11-20`, `21-50`, `51-100`, `101-200`, `201-500`, `501-1000`, `1001-2000`, `2001-5000`, `5001-10000`, `10001-20000`, `20001-50000`, `50000+`

### Include Industries (`company_industry`)
- **Usage**: Optional
- **Type**: `string[]`
- **Common Options**:
  - `information technology & services`, `construction`, `marketing & advertising`, `real estate`, `health, wellness & fitness`, `management consulting`, `computer software`, `internet`, `retail`, `financial services`, etc.

### Exclude Industries (`company_not_industry`)
- **Usage**: Optional
- **Type**: `string[]`

### Include Keywords (`company_keywords`)
- **Usage**: Optional
- **Type**: `array`
- **Description**: Keywords like `restaurant`, `fitness`, `gym`, `software development`.

### Exclude Keywords (`company_not_keywords`)
- **Usage**: Optional
- **Type**: `array`

---

## Revenue & Funding

### Minimum Revenue (`min_revenue`)
- **Usage**: Optional
- **Type**: `string`
- **Options**:
  - `100K`, `500K`, `1M`, `5M`, `10M`, `25M`, `50M`, `100M`, `500M`, `1B`, `5B`, `10B`

### Maximum Revenue (`max_revenue`)
- **Usage**: Optional
- **Type**: `string`
- **Options**:
  - `100K`, `500K`, `1M`, `5M`, `10M`, `25M`, `50M`, `100M`, `500M`, `1B`, `5B`, `10B`

### Funding Round (`funding`)
- **Usage**: Optional
- **Type**: `string[]`
- **Options**:
  - `seed`, `angel`, `series_a`, `series_b`, `series_c`, `series_d`, `series_e`, `series_f`, `venture_round`, `debt_financing`, `convertible_note`, `private_equity_round`, `other_round`

---

## Apify Actor: Leads Finder

**Actor Name**: ✨ [Leads Finder - $1.5/1k leads with Emails [Apollo Alternative]](https://console.apify.com/actors/IoSHqwTR9YGhzccez/input)  
**Pricing**: $1.5 per 1,000 leads (including emails).

### Example JSON Input Structure

This structure can be used as the body for the Apify Actor API call:

```json
{
    "company_domain": ["website url"],
    "company_industry": [
        "information technology & services", "construction", "marketing & advertising", "real estate",
        "health, wellness & fitness", "management consulting", "computer software", "internet",
        "retail", "financial services", "consumer services", "hospital & health care",
        "automotive", "restaurants", "education management", "food & beverages",
        "design", "hospitality", "accounting", "events services",
        "nonprofit organization management", "entertainment", "electrical/electronic manufacturing",
        "leisure, travel & tourism", "professional training & coaching", "transportation/trucking/railroad",
        "law practice", "apparel & fashion", "architecture & planning",
        "mechanical or industrial engineering", "insurance", "telecommunications",
        "human resources", "staffing & recruiting", "sports", "legal services",
        "oil & energy", "media production", "machinery", "wholesale",
        "consumer goods", "music", "photography", "medical practice",
        "cosmetics", "environmental services", "graphic design",
        "business supplies & equipment", "renewables & environment", "facilities services",
        "publishing", "food production", "arts & crafts", "building materials",
        "civil engineering", "religious institutions", "public relations & communications",
        "higher education", "printing", "furniture", "mining & metals",
        "logistics & supply chain", "research", "pharmaceuticals",
        "individual & family services", "medical devices", "civic & social organization",
        "e-learning", "security & investigations", "chemicals",
        "government administration", "online media", "investment management",
        "farming", "writing & editing", "textiles", "mental health care",
        "primary/secondary education", "broadcast media", "biotechnology",
        "information services", "international trade & development", "motion pictures & film",
        "consumer electronics", "banking", "import & export", "industrial automation",
        "recreational facilities & services", "performing arts", "utilities",
        "sporting goods", "fine art", "airlines/aviation"
    ],
    "company_keywords": ["inculde key words"],
    "company_not_keywords": ["exclude keywords"],
    "contact_city": ["city name"],
    "contact_job_title": ["job title "],
    "contact_location": ["india"],
    "contact_not_city": ["exculded location"],
    "contact_not_job_title": ["exculded job title "],
    "contact_not_location": ["germany"],
    "email_status": ["validated"],
    "fetch_count": 1,
    "file_name": "Prospects",
    "functional_level": [
        "c_suite", "finance", "product_management", "engineering", "design", "education",
        "human_resources", "information_technology", "legal", "marketing", "operations",
        "sales", "support"
    ],
    "funding": [
        "seed", "angel", "series_a", "series_b", "series_c", "series_d", "series_e", "series_f",
        "venture_round", "debt_financing", "convertible_note", "private_equity_round", "other_round"
    ],
    "max_revenue": "10B",
    "min_revenue": "100K",
    "seniority_level": [
        "founder", "owner", "c_suite", "director", "partner", "vp", "head", "manager",
        "senior", "entry", "trainee"
    ],
    "size": [
        "1-10", "11-20", "21-50", "51-100", "101-200", "201-500", "501-1000", "1001-2000",
        "2001-5000", "5001-10000", "10001-20000", "20001-50000", "50000+"
    ]
}
```
